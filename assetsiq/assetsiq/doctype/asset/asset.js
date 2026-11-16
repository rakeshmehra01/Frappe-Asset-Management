// Copyright (c) 2026, Rakesh Mehra and contributors
// For license information, please see license.txt

frappe.ui.form.on("Asset", {
    async refresh(frm) {
        frappe.assetsiq_asset_form?.render(frm);
        frm.set_query("assigned_to", () => ({
            filters: {
                enabled: 1,
                user_type: "System User",
                name: ["not in", ["Guest", "Administrator"]],
            },
        }));

        // Show every server-authorized workflow action for the saved record.
        for (const label of frm._aiq_workflow_action_labels || []) {
            frm.remove_custom_button(label);
        }
        frm._aiq_workflow_action_labels = [];
        if (frm.is_new() || frm.is_dirty()) return;

        const identity = frm.doc.name;
        const status = frm.doc.asset_status;
        const request = (frm._aiq_workflow_actions_request || 0) + 1;
        frm._aiq_workflow_actions_request = request;
        const transitions = await frappe.xcall("frappe.model.workflow.get_transitions", {doc: frm.doc});
        if (frm.is_dirty() || frm.doc.name !== identity || frm.doc.asset_status !== status
            || frm._aiq_workflow_actions_request !== request) return;

        const recipientActions = ["Accept Assignment", "Decline Assignment", "Request Maintenance"];
        const actions = [...new Set(transitions.filter(transition => {
            const recipientAllowed = !recipientActions.includes(transition.action)
                || frm.doc.assigned_to === frappe.session.user;
            const approvalAllowed = frappe.session.user === "Administrator"
                || transition.allow_self_approval || frm.doc.owner !== frappe.session.user;
            return recipientAllowed && approvalAllowed;
        }).map(transition => transition.action))];
        const primaryActions = ["Accept Assignment", "Request Assignment", "Request Maintenance",
            "Approve Maintenance", "Complete Maintenance"];
        const primary = primaryActions.find(action => actions.includes(action));

        for (const action of actions) {
            const label = __(action);
            frm.remove_custom_button(label);
            const button = frm.add_custom_button(label, () => {
                if (frm.is_dirty()) {
                    frappe.msgprint(__("Save or reload this asset before using a workflow action."));
                    return;
                }
                if (frm._aiq_workflow_action_busy) return;
                frappe.confirm(__("Are you sure you want to {0}?", [label]), async () => {
                    if (frm._aiq_workflow_action_busy) return;
                    frm._aiq_workflow_action_busy = true;
                    button.prop("disabled", true);
                    try {
                        const doc = await frappe.xcall("frappe.model.workflow.apply_workflow", {
                            doc: frm.doc, action,
                        });
                        if (action === "Decline Assignment") {
                            frappe.show_alert({message: __("Assignment declined."), indicator: "blue"});
                            frappe.set_route("List", "Asset");
                        } else {
                            frappe.model.sync(doc);
                            await frm.reload_doc();
                            frappe.show_alert({message: __("Action completed: {0}", [label]), indicator: "green"});
                        }
                    } finally {
                        frm._aiq_workflow_action_busy = false;
                        button.prop("disabled", false);
                    }
                });
            });
            frm._aiq_workflow_action_labels.push(label);
            if (action === primary) button.removeClass("btn-default").addClass("btn-primary");
        }
    },

    asset_name(frm) { frappe.assetsiq_asset_form?.render(frm); },
    asset_category(frm) { frappe.assetsiq_asset_form?.render(frm); },
    assigned_to(frm) { frappe.assetsiq_asset_form?.render(frm); },
    serial_number(frm) { frappe.assetsiq_asset_form?.render(frm); },
    serial_number_required(frm) { frappe.assetsiq_asset_form?.render(frm); },
    asset_status(frm) { frappe.assetsiq_asset_form?.render(frm); },

    asset_location(frm) { frappe.assetsiq_asset_form?.render(frm); },
    on_tab_change(frm) { frappe.assetsiq_asset_form?.render_guidance?.(frm); },

});
