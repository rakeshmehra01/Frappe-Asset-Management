"""Configure app-owned geographic masters and native dependent Link fields."""

import frappe
from frappe import _


def _permissions():
	return [
		{"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1,
		 "select": 1, "import": 1, "share": 0, "report": 0, "export": 0, "print": 0, "email": 0},
		{"role": "AssetsIQ IT", "read": 1, "write": 1, "create": 1, "select": 1,
		 "import": 1, "delete": 0, "share": 0, "report": 0, "export": 0, "print": 0, "email": 0},
		{"role": "AssetsIQ Employee", "read": 1, "select": 1, "write": 0, "create": 0,
		 "delete": 0, "share": 0, "import": 0, "report": 0, "export": 0, "print": 0, "email": 0},
	]


def _definition(name, label, name_field, parent, parent_label, parent_type):
	return {
		"doctype": "DocType", "name": name, "module": "AssetsIQ", "custom": 0,
		"autoname": "hash", "naming_rule": "Random", "title_field": name_field,
		"show_title_field_in_link": 1, "search_fields": f"{name_field},{parent}",
		"sort_field": name_field, "sort_order": "ASC", "track_changes": 1,
		"quick_entry": 1, "allow_import": 1,
		"fields": [
			{"fieldname": parent, "fieldtype": "Link", "label": parent_label,
			 "options": parent_type, "reqd": 1, "in_list_view": 1, "in_standard_filter": 1},
			{"fieldname": name_field, "fieldtype": "Data", "label": label,
			 "reqd": 1, "in_list_view": 1},
		],
		"permissions": _permissions(),
	}


def setup_location_geography():
	"""Idempotent bench-execute entry point; does not seed geographic records."""
	frappe.only_for("System Manager")
	if frappe.db.get_value("Module Def", "AssetsIQ", "app_name") != "assetsiq":
		frappe.throw(_("The AssetsIQ module must belong to the assetsiq app."))
	location = frappe.get_doc("DocType", "Asset Location")
	if location.module != "AssetsIQ" or location.custom:
		frappe.throw(_("Review Asset Location ownership before continuing."))
	fields = {field.fieldname: field for field in location.fields}
	if not {"country", "state", "district"}.issubset(fields):
		frappe.throw(_("Save Country, State and District in the DocType designer first."))
	if fields["state"].fieldtype == "Select" or fields["district"].fieldtype == "Select":
		# Never silently discard existing text selections when converting to Links.
		if frappe.db.count("Asset Location", {"state": ["is", "set"]}) or frappe.db.count(
			"Asset Location", {"district": ["is", "set"]}
		):
			frappe.throw(_("Existing State/District text values need migration before changing field types."))
	for name in ("Location State", "Location District"):
		if frappe.db.exists("DocType", name):
			existing = frappe.get_doc("DocType", name)
			if existing.module != "AssetsIQ" or existing.custom:
				frappe.throw(_("The existing {0} is not an AssetsIQ standard DocType.").format(name))
	for definition in (
		_definition("Location State", "State Name", "state_name", "country", "Country", "Country"),
		_definition("Location District", "District Name", "district_name", "state", "State", "Location State"),
	):
		if not frappe.db.exists("DocType", definition["name"]):
			frappe.get_doc(definition).insert()

	for name, target, hint in (
		("country", "Country", "Select the country first."),
		("state", "Location State", "Select a state belonging to the chosen country."),
		("district", "Location District", "Select a district belonging to the chosen state."),
	):
		fields[name].fieldtype = "Link"
		fields[name].options = target
		fields[name].description = hint
	location.save()
	frappe.clear_cache()
	return {"country": "Country", "state": "Location State", "district": "Location District"}
