/* IT Operations dashboard: live counts and quick actions */

frappe.assetsiq_it_dashboard = function (root) {
    const dashboard = root.querySelector(".aiq-ops");

    if (!dashboard || dashboard.dataset.itReady === "1") return;
    dashboard.dataset.itReady = "1";

    const refreshButton = dashboard.querySelector(
        '[data-action="refresh"]'
    );
    const message = dashboard.querySelector(
        '[data-region="message"]'
    );
    const updated = dashboard.querySelector(
        '[data-region="updated"]'
    );

    let loading = false;

    async function refreshCounts() {
        if (loading) return;

        loading = true;
        refreshButton.disabled = true;
        message.hidden = true;

        try {
            const rows = await frappe.xcall("frappe.client.get_list", {
                doctype: "Asset",
                fields: [
                    "asset_status",
                    { COUNT: "*", as: "total" }
                ],
                group_by: "asset_status",
                limit_page_length: 0
            });

            if (!root.host.isConnected) return;

            const counts = Object.create(null);

            rows.forEach(row => {
                counts[row.asset_status] = Number(row.total) || 0;
            });

            const values = [
                Object.values(counts).reduce(
                    (sum, value) => sum + value, 0
                ),
                counts.Available || 0,
                counts.Assigned || 0,
                counts["Assignment Requested"] || 0,
                (counts["Maintenance Requested"] || 0) +
                (counts["Under Maintenance"] || 0)
            ];

            dashboard.querySelectorAll(
                ".ops-kpis .aiq-card strong"
            ).forEach((element, index) => {
                element.textContent = values[index].toLocaleString();
            });

            updated.textContent =
                "Counts updated " +
                new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                });

        } catch (error) {
            message.textContent =
                "Could not load asset counts. Please try Refresh.";
            message.hidden = false;
            console.error("AssetsIQ dashboard:", error);

        } finally {
            loading = false;
            refreshButton.disabled = false;
        }
    }

    function openAssets(filters = {}) {
        frappe.route_options = filters;
        frappe.set_route("List", "Asset", "List");
    }

    const canCreate = frappe.model.can_create("Asset");

    dashboard.querySelectorAll(
        '[data-action="new"]'
    ).forEach(button => {
        button.hidden = !canCreate;
    });

    dashboard.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button || button.disabled) return;

        switch (button.dataset.action) {
            case "refresh":
                refreshCounts();
                break;

            case "new":
                if (canCreate) frappe.new_doc("Asset");
                break;

            case "inventory":
                openAssets();
                break;

            case "available":
                openAssets({ asset_status: "Available" });
                break;

            case "maintenance":
                openAssets({
                    asset_status: [
                        "in",
                        ["Maintenance Requested", "Under Maintenance"]
                    ]
                });
                break;
        }
    });

    dashboard.querySelector(".ops-search").addEventListener(
        "submit", event => event.preventDefault()
    );

    return refreshCounts();
};
/* Work queue: live asset rows and search */

frappe.assetsiq_it_queue = function (root) {
    const dashboard = root.querySelector(".aiq-ops");

    if (!dashboard || dashboard.dataset.queueReady === "1") return;
    dashboard.dataset.queueReady = "1";

    const panel = dashboard.querySelector('[data-region="queue"]');
    const footer = dashboard.querySelector('[data-region="pagination"]');
    const search = dashboard.querySelector('input[type="search"]');
    const clearButton = dashboard.querySelector(
        '[data-action="clear-search"]'
    );

    const escape = value =>
        frappe.utils.escape_html(String(value ?? ""));

    let request = 0;
    let timer;

    const filterArea = dashboard.querySelector('[data-region="tabs"]');
    let selectedStatus = "";

    const choices = [
        ["", "All assets"],
        ["Assignment Requested", "Awaiting confirmation"],
        ["Maintenance Requested", "Maintenance requests"],
        ["Under Maintenance", "Under maintenance"]
    ];

    filterArea.setAttribute("role", "group");
    filterArea.setAttribute("aria-label", "Filter assets by status");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Asset work queue");

    filterArea.innerHTML = choices.map(([status, label]) => `
        <button type="button"
                class="aiq-button"
                data-action="queue-filter"
                data-status="${escape(status)}"
                aria-pressed="${status === selectedStatus}">
            ${escape(label)}
        </button>
    `).join("");


    async function loadAssets() {
        clearTimeout(timer);

        const current = ++request;
        const text = search.value.trim();

        clearButton.hidden = !text;
        panel.setAttribute("aria-busy", "true");
        panel.textContent = "Loading assets…";
        footer.textContent = "";

        try {
            const rows = await frappe.xcall("frappe.client.get_list", {
                doctype: "Asset",
                filters: selectedStatus ? { asset_status: selectedStatus } : {},
                fields: [
                    "name",
                    "asset_name",
                    "asset_status",
                    "assigned_to",
                    "asset_location",
                    "asset_location.location_name as location_label",
                    "assigned_to.full_name as recipient_name"
                ],
                or_filters: text
                    ? [
                        ["name", "like", "%" + text + "%"],
                        ["asset_name", "like", "%" + text + "%"],
                        ["serial_number", "like", "%" + text + "%"],
                        ["assigned_to", "like", "%" + text + "%"],
                        ["assigned_to.full_name", "like", "%" + text + "%"]
                    ]
                    : [],
                order_by: "modified desc, name desc",
                limit_page_length: 5
            });

            if (current !== request || !root.host.isConnected) return;

            if (!rows.length) {
                panel.textContent = text
                    ? "No matching assets. Try another search."
                    : selectedStatus
                        ? "No assets in this queue."
                        : "No assets are available for your account.";
                return;
            }

            panel.innerHTML = `
                <div class="ops-table-scroll"
                     tabindex="0"
                     role="region"
                     aria-label="Asset work queue">
                    <table class="table table-hover ops-table">
                        <thead>
                            <tr>
                                <th scope="col">Asset</th>
                                <th scope="col">Recipient</th>
                                <th scope="col">Location</th>
                                <th scope="col">Status</th>
                                <th scope="col">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    <td>
                                        <span class="ops-table-cell"
                                              title="${escape(row.asset_name)}">
                                            ${escape(row.asset_name || row.name)}
                                        </span>
                                        <small>${escape(row.name)}</small>
                                    </td>
                                    <td>
                                        <span class="ops-table-cell"
                                              title="${escape(row.assigned_to)}">
                                            ${escape(
                                                row.recipient_name ||
                                                row.assigned_to ||
                                                "Unassigned"
                                            )}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="ops-table-cell"
                                              title="${escape(
                                                  row.location_label ||
                                                  row.asset_location
                                              )}">
                                            ${escape(
                                                row.location_label ||
                                                row.asset_location ||
                                                "—"
                                            )}
                                        </span>
                                    </td>
                                    <td>${escape(row.asset_status)}</td>
                                    <td>
                                        <button type="button"
                                                class="aiq-button"
                                                data-asset="${escape(row.name)}">
                                            Review
                                        </button>
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            `;

            footer.textContent = rows.length === 5
                ? "Showing the first 5 matches. Open All assets for the full list."
                : "Showing " + rows.length + " assets.";

        } catch (error) {
            if (current !== request) return;

            panel.textContent =
                "Could not load assets. Please select Refresh.";
            console.error("AssetsIQ work queue:", error);

        } finally {
            if (current === request) {
                panel.setAttribute("aria-busy", "false");
            }
        }
    }

    // Desk sees the shadow host as document.activeElement, so its global
    // keyboard shortcuts cannot recognize this focused search input.
    // Keep typing local without cancelling editing or form submission.
    ["keydown", "keypress", "keyup"].forEach(type => {
        search.addEventListener(type, event => event.stopPropagation());
    });

    search.addEventListener("input", () => {
        clearTimeout(timer);
        ++request;

        panel.textContent = "Searching…";
        panel.setAttribute("aria-busy", "true");
        footer.textContent = "";
        clearButton.hidden = !search.value;

        timer = setTimeout(loadAssets, 300);
    });

    dashboard.querySelector(".ops-search").addEventListener(
        "submit", event => {
            event.preventDefault();
            loadAssets();
        }
    );

    dashboard.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        if (button.dataset.action === "refresh") {
            loadAssets();
        }


        if (button.dataset.action === "queue-filter") {
            selectedStatus = button.dataset.status;

            filterArea.querySelectorAll("button").forEach(item => {
                item.setAttribute(
                    "aria-pressed",
                    String(item.dataset.status === selectedStatus)
                );
            });

            loadAssets();
        }

        if (button.dataset.action === "clear-search") {
            search.value = "";
            loadAssets();
            search.focus();
        }
    });

    panel.addEventListener("click", event => {
        const button = event.target.closest("[data-asset]");

        if (button) {
            frappe.set_route("Form", "Asset", button.dataset.asset);
        }
    });

    return loadAssets();
};