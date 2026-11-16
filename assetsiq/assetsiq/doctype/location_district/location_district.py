# Copyright (c) 2026, Rakesh Mehra and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from assetsiq.geography import validate_reference


class LocationDistrict(Document):
	def validate(self):
		validate_reference(self, "district_name", "state")


def on_doctype_update():
	frappe.db.add_unique("Location District", ["state", "district_name"], "unique_district_state")
