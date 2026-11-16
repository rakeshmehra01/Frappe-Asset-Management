//Frappe recognizes the name LocationStateQuickEntryForm when opening Quick Entry for Location State. super.render_dialog() keeps its existing functionality.

// Extend frappe existing Quick Entry Specifically for location state
// Customize Quick Entry specifically for Location State.
frappe.ui.form.LocationStateQuickEntryForm = class extends frappe.ui.form.QuickEntryForm {
    // Run when Frappe creates the popup.
    render_dialog() {
        // Preserve Frappe's fields, validation and saving behavior.
        super.render_dialog();

        // Add a class so our CSS can identify this popup.
        this.$wrapper.addClass("aiq-location-state-dialog");
    }
};