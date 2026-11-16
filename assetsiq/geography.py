"""Validation shared by the app's small geographic reference masters."""

import frappe
from frappe import _


def validate_reference(doc, name_field, parent_field):
	"""Normalize labels, reject duplicates, and keep linked hierarchies stable."""
	doc.set(name_field, " ".join((doc.get(name_field) or "").split()))
	if not doc.get(name_field):
		frappe.throw(_("Enter {0}.").format(doc.meta.get_label(name_field)))

	# Reparenting would invalidate existing Locations; label corrections stay safe.
	if not doc.is_new() and doc.has_value_changed(parent_field):
		frappe.throw(
			_("{0} cannot be changed after creation. Create a new record under the correct parent.")
			.format(doc.meta.get_label(parent_field))
		)

	filters = {
		name_field: doc.get(name_field), parent_field: doc.get(parent_field),
		"name": ["!=", doc.name or ""],
	}
	if frappe.db.exists(doc.doctype, filters):
		frappe.throw(
			_("{0} already exists under the selected {1}.")
			.format(doc.get(name_field), doc.meta.get_label(parent_field)),
			frappe.DuplicateEntryError,
		)
