frappe.ui.form.on('Asset Maintenance', {
    setup(frm) {
        const staff = frappe.session.user === 'Administrator'
            || (frappe.user_roles || []).some(role => ['AssetsIQ IT', 'System Manager'].includes(role));
        frm.set_query('asset_name', () => ({filters: staff
            ? {asset_status: ['in', ['Available', 'Assigned', 'Maintenance Requested', 'Under Maintenance']]}
            : {assigned_to: frappe.session.user, asset_status: ['in', ['Assigned', 'Maintenance Requested']]}}));
        frm.set_query('handled_by', () => ({
            query: 'assetsiq.assetsiq.doctype.asset_maintenance.asset_maintenance.technician_query',
        }));
    },
    refresh(frm) {
        const staff = frappe.session.user === 'Administrator'
            || (frappe.user_roles || []).some(role => ['AssetsIQ IT', 'System Manager'].includes(role));
        frm.set_df_property('asset_name', 'read_only', !frm.is_new());
        const editable = staff || frm.is_new() || frm.doc.status === 'Requested';
        ['issue_title', 'issue_description', 'priority'].forEach(field => frm.set_df_property(field, 'read_only', !editable));
        if (!editable) frm.disable_save();
    },
    async asset_name(frm) {
        if (!frm.is_new() || !frm.doc.asset_name) return;
        const asset = frm.doc.asset_name;
        const result = await frappe.db.get_value('Asset', asset, 'asset_name');
        if (frm.is_new() && frm.doc.asset_name === asset) {
            frm.set_value('asset_title', result.message?.asset_name || '');
        }
    },
});
