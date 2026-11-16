// AssetsIQ Soft Rows: keep native data queries, selection and workflow handling.
(() => {
    const escape = value => frappe.utils.escape_html(String(value ?? ""));
    const tabs = [
        {key: "all", label: "All assets", statuses: []},
        {key: "available", label: "Available", statuses: ["Available"]},
        {key: "requests", label: "Assignment requests", statuses: ["Assignment Requested"]},
        {key: "maintenance", label: "Maintenance", statuses: ["Maintenance Requested", "Under Maintenance"]},
    ];
    const tones = {
        Available: "available", Assigned: "assigned", "Assignment Requested": "requested",
        "Maintenance Requested": "maintenance", "Under Maintenance": "maintenance", Retired: "retired",
    };
    function parts(filter) {
        if (!Array.isArray(filter)) return {};
        const offset = filter.length === 3 ? 0 : 1;
        return {field: filter[offset], operator: filter[offset + 1], value: filter[offset + 2]};
    }
    function base_filters(filters) {
        return JSON.parse(JSON.stringify(filters.filter(filter => parts(filter).field !== "asset_status")));
    }
    function selected_tab(filters) {
        const statusFilters = filters.map(parts).filter(filter => filter.field === "asset_status");
        if (!statusFilters.length) return "all";
        if (statusFilters.length !== 1) return null;
        const filter = statusFilters[0];
        const values = filter.operator === "=" ? [filter.value]
            : filter.operator === "in" && Array.isArray(filter.value) ? filter.value : [];
        if (!values.length) return null;
        return tabs.find(tab => tab.statuses.length === values.length
            && tab.statuses.every(status => values.includes(status)))?.key || null;
    }
    function own_scope(filters) {
        const staff = frappe.session.user === "Administrator"
            || (frappe.user_roles || []).some(role => ["AssetsIQ IT", "System Manager"].includes(role));
        return !staff || filters.some(filter => {
            const f = parts(filter);
            return f.field === "assigned_to" && f.operator === "=" && f.value === frappe.session.user;
        });
    }
    function count_tabs(rows) {
        const counts = Object.fromEntries(tabs.map(tab => [tab.key, 0]));
        for (const row of rows) {
            const count = Number(row.count) || 0;
            counts.all += count;
            for (const tab of tabs.slice(1)) {
                if (tab.statuses.includes(row.asset_status)) counts[tab.key] += count;
            }
        }
        return counts;
    }
    async function apply_tab(listview, key) {
        const tab = tabs.find(tab => tab.key === key);
        if (!tab || listview._aiq_filter_busy) return;
        listview._aiq_filter_busy = true;
        const head = listview.page.main.find(".aiq-asset-list-intro");
        head.find("[data-aiq-asset-filter]").prop("disabled", true);
        try {
            const next = base_filters(listview.filter_area.get());
            if (tab.statuses.length) {
                next.push(["Asset", "asset_status", tab.statuses.length === 1 ? "=" : "in",
                    tab.statuses.length === 1 ? tab.statuses[0] : [...tab.statuses]]);
            }
            // Restore every non-status filter, including My Workspace's recipient.
            await listview.filter_area.clear(false);
            await listview.filter_area.set(next);
            listview.start = 0;
            await listview.refresh();
        } finally {
            listview._aiq_filter_busy = false;
            head.find("[data-aiq-asset-filter]").prop("disabled", false);
        }
    }
    function introduction() {
        return `<section class="aiq-asset-list-intro" aria-labelledby="aiq-asset-list-title">
            <header><span class="aiq-asset-list-context"></span><h2 id="aiq-asset-list-title"></h2>
                <p>${escape(__("Find equipment, review assignment requests and keep your inventory moving."))}</p></header>
            <div class="aiq-asset-list-tabs" role="group" aria-label="${escape(__("Filter assets by status"))}">
                ${tabs.map(tab => `<button type="button" data-aiq-asset-filter="${tab.key}" aria-pressed="false">
                    <span class="aiq-filter-label">${escape(__(tab.label))}</span><span class="aiq-filter-count">…</span></button>`).join("")}
            </div></section>`;
    }
    function ensure_header(listview) {
        let head = listview.page.main.find(".aiq-asset-list-intro");
        if (!head.length) {
            listview.page.page_form.before(introduction());
            head = listview.page.main.find(".aiq-asset-list-intro");
            head.on("click", "[data-aiq-asset-filter]", event => {
                apply_tab(listview, event.currentTarget.dataset.aiqAssetFilter);
            });
        }
        const filters = listview.filter_area?.get() || [];
        const mine = own_scope(filters);
        const selected = selected_tab(filters);
        head.find(".aiq-asset-list-context").text(mine ? __("My Workspace / Equipment") : __("IT Operations / Inventory"));
        head.find("h2").text(mine ? __("My Assets") : __("Assets"));
        head.find('[data-aiq-asset-filter="all"] .aiq-filter-label').text(mine ? __("My assets") : __("All assets"));
        head.find('[data-aiq-asset-filter="available"]').toggle(!mine);
        head.find("[data-aiq-asset-filter]").each((_, button) => {
            const active = button.dataset.aiqAssetFilter === selected;
            $(button).toggleClass("is-active", active).attr("aria-pressed", String(active));
        });
        return head;
    }
    async function update_counts(listview) {
        const head = ensure_header(listview);
        const filters = base_filters(listview.filter_area.get());
        const signature = JSON.stringify(filters);
        const request = (listview._aiq_count_request || 0) + 1;
        listview._aiq_count_request = request;
        try {
            // Standard get_list applies the same record permissions as the rows.
            const rows = await frappe.xcall("frappe.client.get_list", {
                doctype: "Asset", fields: ["asset_status", {COUNT: "*", as: "count"}],
                filters, group_by: "asset_status", limit_page_length: 0,
            });
            if (listview._aiq_count_request !== request
                || signature !== JSON.stringify(base_filters(listview.filter_area.get()))) return;
            const counts = count_tabs(rows);
            for (const tab of tabs) {
                head.find(`[data-aiq-asset-filter="${tab.key}"] .aiq-filter-count`).text(counts[tab.key]);
            }
        } catch (error) {
            if (listview._aiq_count_request === request) head.find(".aiq-filter-count").text("—");
        }
    }
    function refine_filters(listview) {
        const fields = listview.page.fields_dict;
        fields.name?.set_label(__("Asset ID"));
        fields.name?.$input?.attr({placeholder: __("Search asset ID…"), "aria-label": __("Search by asset ID")});
        fields.asset_name?.$input?.attr({placeholder: __("Search asset names…"), "aria-label": __("Search by asset name")});
        fields.asset_category?.$input?.attr({placeholder: __("Category"), "aria-label": __("Filter by asset category")});
        fields.asset_location?.$input?.attr({placeholder: __("Location"), "aria-label": __("Filter by asset location")});
    }
    function decorate_rows(listview) {
        const documents = new Map(listview.data.map(doc => [String(doc.name), doc]));
        listview.$result.find(".list-subject a[data-name]").each((_, link) => {
            const doc = documents.get(link.dataset.name);
            if (!doc) return;
            link.classList.add("aiq-soft-asset-subject");
            let subtitle = link.querySelector(".aiq-soft-asset-subtitle");
            if (!subtitle) {
                subtitle = document.createElement("span");
                subtitle.className = "aiq-soft-asset-subtitle";
                link.appendChild(subtitle);
            }
            subtitle.textContent = [doc.name, doc.asset_category].filter(Boolean).join(" · ");
            const row = link.closest(".list-row-container");
            if (row) row.dataset.aiqAssetTone = tones[doc.asset_status] || "retired";
        });
    }
    function recipient(value, df, doc = {}) {
        if (!value) return `<span class="aiq-asset-unassigned">${escape(__("Unassigned"))}</span>`;
        const title = doc.assigned_to_full_name || frappe.utils.get_link_title?.("User", value) || value;
        const initial = Array.from(String(title).trim())[0] || "?";
        return `<span class="aiq-asset-recipient" title="${escape(title)}"><span class="aiq-asset-avatar" aria-hidden="true">${escape(initial.toUpperCase())}</span><span>${escape(title)}</span></span>`;
    }
    frappe.assetsiq_asset_list = {tabs, base_filters, selected_tab, own_scope, count_tabs, apply_tab, recipient, decorate_rows, update_counts};
    frappe.listview_settings.Asset = {
        add_fields: ["asset_name", "asset_category", "asset_status", "assigned_to", "serial_number"],
        hide_name_column: true,
        custom_filter_configs: [
            {fieldname: "asset_category", fieldtype: "Link", options: "Asset Category", label: __("Category"), condition: "=", is_filter: 1},
            {fieldname: "asset_location", fieldtype: "Link", options: "Asset Location", label: __("Location"), condition: "=", is_filter: 1},
        ],
        formatters: {assigned_to: recipient},
        button: {
            show: () => true,
            get_label: doc => doc.asset_status === "Assignment Requested" ? __("Review request") : __("Open asset"),
            get_description: doc => doc.asset_status === "Assignment Requested" ? __("Open this asset to review its assignment request") : __("Open asset details"),
            action: doc => frappe.set_route("Form", "Asset", doc.name),
        },
        onload(listview) {
            $(listview.page.wrapper).addClass("aiq-soft-asset-list aqi-executive-list");
            // Category is shown under the subject instead of in a second column.
            // Keep an explicitly configured custom column selection intact.
            if (!listview.list_view_settings?.fields?.length) {
                listview.columns = listview.columns.filter(column => column.df?.fieldname !== "asset_category");
            }
            ensure_header(listview);
            refine_filters(listview);
        },
        refresh(listview) {
            ensure_header(listview);
            refine_filters(listview);
            decorate_rows(listview);
            update_counts(listview);
        },
    };
})();
