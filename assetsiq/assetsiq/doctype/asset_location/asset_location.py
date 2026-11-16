# Copyright (c) 2026, Rakesh Mehra and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class AssetLocation(Document):
	def validate(self):
		self.location_name = " ".join((self.location_name or "").split())
		if not self.location_name:
			self.location_name = suggest_location_name(self)
		# Client filters help selection; these checks also protect imports/API saves.
		if self.state:
			if not self.country:
				frappe.throw(_("Select a Country before selecting a State."))
			if frappe.db.get_value("Location State", self.state, "country") != self.country:
				frappe.throw(_("The selected State does not belong to the selected Country."))

		if self.district:
			if not self.state:
				frappe.throw(_("Select a State before selecting a District."))
			if frappe.db.get_value("Location District", self.district, "state") != self.state:
				frappe.throw(_("The selected District does not belong to the selected State."))


def suggest_location_name(doc):
	"""Use existing descriptive data; never rename the document or its links."""
	address = " ".join((doc.get("address") or "").split())
	if address:
		return address[:140]
	parts = []
	for field, doctype, title in (
		("district", "Location District", "district_name"),
		("state", "Location State", "state_name"),
	):
		if doc.get(field):
			label = frappe.db.get_value(doctype, doc.get(field), title)
			if label and label not in parts:
				parts.append(label)
	if doc.get("country") and doc.country not in parts:
		parts.append(doc.country)
	return (", ".join(parts) or f"Location {doc.name}")[:140]
