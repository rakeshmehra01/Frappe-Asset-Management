# Copyright (c) 2026, Rakesh Mehra and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
class Asset(Document):
    def validate(self):
        serial_required = frappe.db.get_value(
            "Asset Category",
            self.asset_category,
            "serial_required",
        )

# Read the category rule directly rather than trusting the form value.
        self.serial_number_required = int(serial_required or 0)
        serial = (self.serial_number or "").strip()

        if serial == "0":
            frappe.throw(_("Serial Number cannot be 0."))

        if self.serial_number_required and not (self.serial_number or "").strip():
            frappe.throw(
                _("Serial Number is required for the selected Asset Category.")
            )
            
        if self.asset_status in (
            "Assignment Requested",
            "Assigned",
            "Maintenance Requested",
            "Under Maintenance",
        ) and not self.assigned_to:
            frappe.throw(
                _("Select Assigned To for this Asset Status.")
            )

        previous = self.get_doc_before_save()

        if (
            previous
            and previous.asset_status in ("Assignment Requested", "Assigned")
            and self.asset_status == "Available"
        ):
            self.assigned_to = None
            
        if self.assigned_to:
            user = frappe.db.get_value(
                "User",
                self.assigned_to,
                ["enabled", "user_type"],
                as_dict=True,
            )

            if (
                self.assigned_to in ("Guest", "Administrator")
                or not user
                or not user.enabled
                or user.user_type != "System User"
            ):
                frappe.throw(
                    _("Assigned To must be an enabled System User, "
                      "excluding Guest and Administrator.")
                )
    