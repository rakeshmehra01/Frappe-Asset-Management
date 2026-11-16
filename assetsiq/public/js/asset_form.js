// Presentation only: native fields, permissions and workflow actions stay in Frappe.
(() => {
    const escape = value => frappe.utils.escape_html(String(value ?? ""));
    const tones = {
        Available: "available",
        "Assignment Requested": "requested",
        Assigned: "assigned",
        "Maintenance Requested": "requested",
        "Under Maintenance": "maintenance",
        Retired: "retired",
    };

    const paths = {
        asset: '<path d="m12 3 9 5v8l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
        tool: '<path d="M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4Z"/>',
    };
    const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;

    function presentation(doc, isNew = false) {
        const status = doc.asset_status || "Available";
        const mine = doc.assigned_to === frappe.session.user;
        let title, message;
        switch (status) {
            case "Assignment Requested":
                title = mine ? __("Confirm your assignment") : __("Awaiting recipient confirmation");
                message = mine
                    ? __("Review this asset, then choose Accept Assignment or Decline Assignment above.")
                    : __("The selected recipient must accept before this asset becomes Assigned.");
                break;
            case "Assigned":
                title = mine ? __("Assigned to you") : __("Assignment confirmed");
                message = __("The assigned user can request maintenance through the Actions menu.");
                break;
            case "Maintenance Requested":
                title = __("Maintenance requested");
                message = __("The IT team will review the maintenance request.");
                break;
            case "Under Maintenance":
                title = __("Under maintenance");
                message = __("The IT team will update this asset when maintenance is complete.");
                break;
            case "Retired":
                title = __("Asset retired");
                message = __("This asset is no longer available for assignment.");
                break;
            default:
                title = doc.assigned_to ? __("Ready for assignment") : __("Choose a recipient");
                message = doc.assigned_to
                    ? __("Save the recipient while the asset is Available, then choose Request Assignment from Actions.")
                    : __("The IT team can select an enabled user in Assigned To and save before requesting assignment.");
        }
        const identity = isNew ? __("New Asset") : doc.name;
        const name = doc.asset_name || __("Register an asset");
        const serial = doc.serial_number || __("Not provided");
        const assignment = (doc.assigned_to && frappe.utils.get_link_title?.("User", doc.assigned_to))
            || doc.assigned_to || __("Not selected");
        const category = doc.asset_category || __("Asset");
        const subtitle = isNew ? __("Asset registration") : __("Asset details");
        const tone = tones[status] || "retired";
        const noticeIcon = status === "Assigned" ? "check"
            : status === "Under Maintenance" ? "tool"
            : tone === "requested" ? "clock" : "info";
        return {
            notice: {title, message, tone},
            header: `<header class="aiq-asset-header">
                <div class="aiq-asset-identity"><span class="aiq-asset-emblem">${icon("asset")}</span>
                    <div class="aiq-asset-heading"><span class="aiq-asset-reference">${escape(identity)}</span>
                        <h2>${escape(name)}</h2><p><span>${escape(category)}</span><span class="aiq-asset-meta-separator" aria-hidden="true">/</span>${escape(subtitle)}</p></div></div>
                <span class="aiq-asset-status aiq-asset-status--${tone}">
                    <span aria-hidden="true"></span>${escape(__(status))}</span>
            </header>`,
            summary: `<section class="aiq-asset-overview" aria-label="${escape(__("Asset summary"))}">
                <dl class="aiq-asset-summary"><div><dt>${escape(__("Serial number"))}</dt><dd class="aiq-asset-serial${doc.serial_number ? "" : " is-empty"}">${escape(serial)}</dd></div>
                    <div><dt>${escape(__("Recipient"))}</dt><dd${doc.assigned_to ? "" : ' class="is-empty"'}>${escape(assignment)}</dd></div></dl>
                <aside class="aiq-asset-notice aiq-asset-notice--${tone}"><span class="aiq-asset-notice-icon">${icon(noticeIcon)}</span>
                    <div><h3>${escape(title)}</h3><p>${escape(message)}</p></div></aside>
                <p class="aiq-asset-workflow-note">${icon("info")}<span>${escape(__("Asset status is managed through workflow actions."))}</span></p>
            </section>`,
        };
    }

    function guidance(doc, tab = "asset_overview_tab", isNew = false) {
        const staff = frappe.session.user === "Administrator"
            || (frappe.user_roles || []).some(role => ["AssetsIQ IT", "System Manager"].includes(role));
        const editable = staff && doc.asset_status !== "Assignment Requested";
        const preparing = staff && (isNew || (doc.asset_status || "Available") === "Available");
        const requiredSerial = Number(doc.serial_number_required) === 1;
        const notice = presentation(doc, isNew).notice;
        let title, description, steps;
        if (tab === "asset_identification_tab") {
            title = __("Identification guide");
            description = __("Check the details that identify this device.");
            steps = [
                [__("Check the serial number"), requiredSerial
                    ? __("A serial number is required. Match it to the device label.")
                    : __("A serial number is optional for this category. Add it if available.")],
                [__("Keep identification accurate"), __("Use a unique serial number. The value 0 is not accepted.")],
                [__("Follow the workflow"), __("Workflow actions update Asset Status; it is read-only here.")],
            ];
        } else if (tab === "asset_notes_tab") {
            title = __("Notes guide");
            description = editable ? __("Leave useful context for the next person handling this asset.")
                : __("Read the additional information recorded by your IT team.");
            steps = editable ? [
                [__("Describe its condition"), __("Mention wear, damage or anything the recipient should check.")],
                [__("List included accessories"), __("List items such as a charger or case, then save your changes.")],
            ] : [
                [__("Review condition and accessories"), __("Check any notes about the device and the items supplied with it.")],
                [__("Report corrections to IT"), __("Contact IT for corrections. Employees cannot edit asset details.")],
            ];
        } else {
            title = __("Overview guide");
            description = preparing ? __("Add the basics, then send the assignment request.")
                : __("Review the details before using a workflow action.");
            steps = [
                [preparing ? __("Identify the asset") : __("Review asset details"),
                    __("Name and category identify the asset and its serial-number rules.")],
                [preparing ? __("Set the location") : __("Confirm its location"),
                    __("Choose the named office, room or storage area.")],
                [preparing ? __("Choose the recipient") : __("Review the assignment"), preparing
                    ? __("Select Assigned To, save while Available, then use Actions to request assignment.")
                    : doc.asset_status === "Assignment Requested"
                        ? __("Only the selected recipient can accept or decline this request.")
                        : __("Use workflow actions for maintenance, returns or retirement, according to your role.")],
            ];
        }
        const status = doc.asset_status || "Available";
        const audience = staff ? __("IT guidance") : __("Recipient guidance");
        const guideIcon = tab === "asset_identification_tab" ? "check"
            : tab === "asset_notes_tab" ? "info" : "asset";
        const nextIcon = notice.tone === "requested" ? "clock"
            : status === "Assigned" ? "check" : status === "Under Maintenance" ? "tool" : "info";
        let nextMessage = notice.message;
        if (status === "Assignment Requested" && doc.assigned_to === frappe.session.user) {
            nextMessage = __("Review the device details, then choose Accept Assignment or Decline Assignment at the top of this form.");
        } else if (status === "Assigned" && doc.assigned_to === frappe.session.user) {
            nextMessage = __("If this device needs attention, choose Request Maintenance at the top of this form.");
        } else if (status === "Maintenance Requested" && staff) {
            nextMessage = __("Review the request, then choose Approve Maintenance or Decline Maintenance at the top of this form.");
        } else if (status === "Under Maintenance" && staff && doc.assigned_to) {
            nextMessage = __("When the work is finished, choose Complete Maintenance at the top of this form.");
        }
        return `<aside class="aiq-asset-guide" aria-label="${escape(title)}">
            <div class="aiq-asset-guide-heading"><span>${icon(guideIcon)}</span><div>
                <small>${escape(__("Asset assistant"))}</small><h3>${escape(title)}</h3></div></div>
            <p class="aiq-asset-guide-description">${escape(description)}</p>
            <div class="aiq-asset-guide-context"><span class="aiq-asset-guide-status aiq-asset-guide-status--${notice.tone}">${escape(__(status))}</span>
                <span class="aiq-asset-guide-audience">${escape(audience)}</span></div>
            <h4 class="aiq-asset-guide-checklist-title">${escape(__("Check before you continue"))}</h4>
            <ol class="aiq-asset-guide-steps" role="list">${steps.map(([label, text], index) => `<li>
                <span class="aiq-asset-guide-step" aria-hidden="true">${index + 1}</span>
                <div class="aiq-asset-guide-step-copy"><h4>${escape(label)}</h4><p>${escape(text)}</p></div></li>`).join("")}</ol>
            <div class="aiq-asset-guide-next aiq-asset-guide-next--${notice.tone}">
                <div class="aiq-asset-guide-next-heading"><span class="aiq-asset-guide-next-icon">${icon(nextIcon)}</span><div>
                    <small>${escape(__("Next step"))}</small><h4>${escape(notice.title)}</h4></div></div>
                <p>${escape(nextMessage)}</p></div>
        </aside>`;
    }

    function render_guidance(frm) {
        const container = frm.layout?.tabs_content;
        if (!container?.length) return;
        const tab = frm.get_active_tab?.()?.df?.fieldname || "asset_overview_tab";
        container.children(".aiq-asset-guide").remove();
        container.append(guidance(frm.doc, tab, frm.is_new()));
        container.addClass("aiq-has-asset-guide");
    }

    function render(frm) {
        $(frm.page.wrapper).addClass("aiq-asset-form");
        $(frm.wrapper).addClass("aiq-asset-fields");
        const content = presentation(frm.doc, frm.is_new());
        frm.dashboard.parent.find(".aiq-asset-intro").remove();
        frm.dashboard.add_section(content.header, null, "custom aiq-asset-intro");
        frm.dashboard.show();
        const summary = frm.fields_dict.asset_overview_summary;
        if (summary) summary.$wrapper.html(content.summary);
        render_guidance(frm);
        const description = frm.fields_dict.description?.$input;
        if (description && !description.data("aiq-asset-height")) {
            description.css("min-height", "160px").data("aiq-asset-height", true);
        }
    }

    frappe.assetsiq_asset_form = {render, presentation, guidance, render_guidance};
})();
