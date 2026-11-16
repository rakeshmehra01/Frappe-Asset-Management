frappe.listview_settings['Asset Maintenance'] = {
    add_fields: ['status', 'priority'],
    get_indicator(doc) {
        const colours = {Requested: 'orange', 'In Progress': 'blue', Completed: 'green', Rejected: 'red', Cancelled: 'gray'};
        return [__(doc.status), colours[doc.status] || 'gray', 'status,=,' + doc.status];
    },
};
