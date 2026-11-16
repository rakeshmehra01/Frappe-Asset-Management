// One AssetsIQ sidebar, driven by the current workspace and this mapping.
(() => {
    const workspaces = [
        {
            name: "AssetsIQ — IT Operations", label: "IT Operations", icon: "grid",
            items: [
                {doctype: "Asset", label: "Assets"},
                {doctype: "Asset Maintenance", label: "Maintenance"},
                {doctype: "Asset Category"},
                {
                    label: "Locations",
                    children: [
                        {doctype: "Asset Location"},
                        {doctype: "Location State"},
                        {doctype: "Location District"},
                    ],
                },
            ],
        },
        {
            name: "AssetsIQ — My Workspace", label: "My Workspace", icon: "user",
            items: [
                {doctype: "Asset", label: "My Assets", own_assets: true},
                {doctype: "Asset Maintenance", label: "My Maintenance", own_requests: true},
            ],
        },
    ];
    const slug = value => frappe.router.slug(value);
    const escape = value => frappe.utils.escape_html(String(value ?? ""));
    let queued = false;
    let observer;
    let preferred_workspace;
    const group_states = new Map();

    function available_workspaces() {
        const allowed = new Set((frappe.boot.workspaces?.pages || []).map(page => page.name));
        return workspaces.filter(workspace => allowed.has(workspace.name));
    }
    function visible_items(workspace) {
        function permitted(items) {
            return items.flatMap(item => {
                if (Array.isArray(item.children)) {
                    const children = permitted(item.children);
                    return children.length ? [{...item, children}] : [];
                }
                return item.doctype && frappe.model.can_read(item.doctype) ? [item] : [];
            });
        }
        return permitted(workspace.items);
    }
    function leaf_items(items) {
        return items.flatMap(item => item.children ? leaf_items(item.children) : [item]);
    }
    function resolve_view(route, allowed = available_workspaces()) {
        if (route[0] === "assetsiq-home") return {active: true, home: true};
        if (route[0] === "Workspaces") {
            const workspace = allowed.find(item => [item.name.toLowerCase(), slug(item.name)].includes((route[1] || "").toLowerCase()));
            if (workspace) preferred_workspace = workspace.name;
            return workspace ? {workspace, active: true} : {active: false};
        }
        if (["List", "Form", "Tree"].includes(route[0])) {
            const candidates = allowed.filter(item => leaf_items(visible_items(item)).some(link => link.doctype === route[1]));
            const workspace = candidates.find(item => item.name === preferred_workspace) || candidates[0];
            if (workspace) return {workspace, active: true};
        }
        // Unassigned AssetsIQ screens start with the workspace chooser.
        const screens = frappe.boot.assetsiq_routes || {};
        const active = (["List", "Form", "Tree"].includes(route[0]) && (screens.doctypes || []).includes(route[1]))
            || (screens.pages || []).includes(route[0])
            || (route[0] === "query-report" && (screens.reports || []).includes(route[1]));
        return {active: Boolean(active)};
    }
    function workspace_path(workspace) {
        return `/desk/${slug(workspace.name)}`;
    }
    function link(label, path, icon, active = false, workspace = "") {
        return `<div class="sidebar-item-container" item-name="${escape(label)}">
            <div class="standard-sidebar-item${active ? " active-sidebar" : ""}">
                <a class="item-anchor" href="${escape(path)}" title="${escape(__(label))}"${active ? ' aria-current="page"' : ""}${workspace ? ` data-aiq-workspace="${escape(workspace)}"` : ""}>
                    <span class="sidebar-item-icon">${frappe.utils.icon(icon, "sm")}</span>
                    <span class="sidebar-item-label">${escape(__(label))}</span>
                </a>
            </div></div>`;
    }
    function render_items(items, route, workspace, parents = []) {
        return items.map((item, index) => {
            if (item.children) {
                const path = [...parents, index];
                const key = JSON.stringify([workspace, path]);
                const active = leaf_items(item.children).some(child => child.doctype === route[1]);
                const open = group_states.has(key) ? group_states.get(key) : active;
                return `<details class="aiq-navigation-group" data-aiq-group="${escape(key)}"${open ? " open" : ""}>
                    <summary class="standard-sidebar-item" title="${escape(__(item.label))}">
                        <span class="item-anchor">
                            <span class="sidebar-item-icon">${frappe.utils.icon("folder-normal", "sm")}</span>
                            <span class="sidebar-item-label">${escape(__(item.label))}</span>
                            <span class="aiq-group-arrow" aria-hidden="true">${frappe.utils.icon("chevron-right", "xs")}</span>
                        </span>
                    </summary>
                    <div class="aiq-navigation-children">${render_items(item.children, route, workspace, path)}</div>
                </details>`;
            }
            return link(item.label || item.doctype,
                frappe.utils.generate_route({
                    type: "DocType", name: item.doctype, doc_view: "List",
                    route_options: item.own_assets ? {assigned_to: frappe.session.user}
                        : item.own_requests ? {requested_by: frappe.session.user} : undefined,
                }),
                "list", route[1] === item.doctype);
        }).join("");
    }
    function render() {
        queued = false;
        const sidebar = frappe.app?.sidebar;
        const host = document.querySelector(".body-sidebar .sidebar-items");
        if (!sidebar || !host) return;
        const view = resolve_view(frappe.get_route());
        // Keep Frappe's editor and unrelated apps working normally.
        if (!view.active || sidebar.editor?.edit_mode) {
            if (host.querySelector(".aiq-workspace-navigation")) sidebar.make_sidebar();
            return;
        }
        const allowed = available_workspaces();
        const selected = view.workspace;
        let content;
        if (!selected) {
            content = link("Home", "/desk/assetsiq-home", "home", Boolean(view.home));
        } else {
            const items = visible_items(selected);
            const route = frappe.get_route();
            content = link("Home", "/desk/assetsiq-home", "home");
            content += '<div class="aiq-navigation-divider" aria-hidden="true"></div>';
            content += link(selected.label, workspace_path(selected), selected.icon, route[0] === "Workspaces", selected.name);
            content += render_items(items, route, selected.name);

        }
        const signature = JSON.stringify([selected?.name, content]);
        if (host.querySelector(".aiq-workspace-navigation")?.dataset.signature === signature) return;
        const navigation = document.createElement("nav");
        navigation.className = "aiq-workspace-navigation";
        navigation.setAttribute("aria-label", __("AssetsIQ workspaces"));
        navigation.dataset.signature = signature;
        navigation.innerHTML = content;
        navigation.querySelectorAll("[data-aiq-workspace]").forEach(anchor => anchor.addEventListener("click", event => {
            if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            frappe.set_route("Workspaces", anchor.dataset.aiqWorkspace);
            // Also switch when choosing the workspace that is already open.
            schedule();
        }));
        navigation.querySelectorAll("[data-aiq-group]").forEach(group => {
            group.addEventListener("toggle", () => group_states.set(group.dataset.aiqGroup, group.open));
        });
        host.replaceChildren(navigation);
    }
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(render);
    }
    function home_markup() {
        const cards = available_workspaces().map(workspace => {
            const description = workspace.label === "IT Operations"
                ? "Manage asset setup, locations and IT operations."
                : "Your assigned assets, requests and updates.";
            return `<a class="aiq-workspace-card" href="${escape(workspace_path(workspace))}">
                <span class="aiq-workspace-card-icon">${frappe.utils.icon(workspace.icon, "lg")}</span>
                <h2>${escape(__(workspace.label))}</h2>
                <p>${escape(__(description))}</p>
                <span class="aiq-workspace-card-open">${escape(__("Open workspace"))} <span aria-hidden="true">→</span></span>
            </a>`;
        }).join("");
        return `<section class="aiq-home-content" aria-labelledby="aiq-home-title">
            <header><span class="aiq-home-eyebrow">${escape(__("AssetsIQ"))}</span>
                <h1 id="aiq-home-title">${escape(__("Your workspaces"))}</h1>
                <p>${escape(__("Choose a workspace to get started."))}</p></header>
            <div class="aiq-workspace-grid">${cards || `<p>${escape(__("No workspaces are available for your account."))}</p>`}</div>
        </section>`;
    }
    // Expose the mapping for inspection and navigation regression checks.
    frappe.assetsiq_navigation = {workspaces, resolve_view, visible_items, available_workspaces, home_markup, render_items};
    frappe.router.on("change", () => {
        // Opening a child directly reveals its group, including browser history.
        const route = frappe.get_route();
        const view = resolve_view(route);
        function reveal(items, parents = []) {
            items.forEach((item, index) => {
                if (!item.children) return;
                const path = [...parents, index];
                if (leaf_items(item.children).some(child => child.doctype === route[1])) {
                    group_states.set(JSON.stringify([view.workspace.name, path]), true);
                    reveal(item.children, path);
                }
            });
        }
        if (view.workspace) reveal(visible_items(view.workspace));
        schedule();
    });
    $(document).on("page-change.assetsiq-navigation sidebar_setup.assetsiq-navigation sidebar-expand.assetsiq-navigation", schedule);
    frappe.after_ajax(() => {
        const sidebar = document.querySelector(".body-sidebar-container");
        if (sidebar && !observer) {
            observer = new MutationObserver(schedule);
            observer.observe(sidebar, {childList: true, subtree: true});
        }
        schedule();
    });
})();
