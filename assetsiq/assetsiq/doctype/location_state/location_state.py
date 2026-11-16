# Copyright (c) 2026, Rakesh Mehra and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from assetsiq.geography import validate_reference


class LocationState(Document):
	def validate(self):
		validate_reference(self, "state_name", "country")


def on_doctype_update():
	# The database also prevents duplicates inserted by concurrent requests.
	frappe.db.add_unique("Location State", ["country", "state_name"], "unique_state_country")
