import frappe


def asset_query_conditions(user=None):
    user = user or frappe.session.user
    roles = frappe.get_roles(user)

    if user == "Administrator" or any(
        role in roles for role in ("AssetsIQ IT", "System Manager")
    ):
        return ""

    if "AssetsIQ Employee" not in roles:
        return "1=0"

    return """
        `tabAsset`.`assigned_to` = {user}
        AND `tabAsset`.`asset_status` IN (
            'Assignment Requested',
            'Assigned',
            'Maintenance Requested',
            'Under Maintenance'
        )
    """.format(user=frappe.db.escape(user))


def asset_has_permission(doc, ptype=None, user=None):
    user = user or frappe.session.user
    roles = frappe.get_roles(user)

    if user == "Administrator" or any(
        role in roles for role in ("AssetsIQ IT", "System Manager")
    ):
        return True

    if "AssetsIQ Employee" not in roles:
        return False

    if ptype not in (None, "read", "write", "select"):
        return False

    if doc.is_new():
        return False

    asset = frappe.db.get_value(
        "Asset",
        doc.name,
        ["assigned_to", "asset_status"],
        as_dict=True,
    )

    return bool(
        asset
        and asset.assigned_to == user
        and asset.asset_status in (
            "Assignment Requested",
            "Assigned",
            "Maintenance Requested",
            "Under Maintenance",
        )
    )


def validate_employee_asset_changes(doc, method=None):
    """Allow employees only the intended workflow changes on their own assets."""
    user = frappe.session.user
    roles = frappe.get_roles(user)

    if user == "Administrator" or any(
        role in roles for role in ("AssetsIQ IT", "System Manager")
    ):
        return

    previous = doc.get_doc_before_save()

    if not previous or previous.assigned_to != user:
        frappe.throw("You can only act on your own assigned assets.")

    allowed_changes = {
        ("Assignment Requested", "Assigned"),
        ("Assignment Requested", "Available"),
        ("Assigned", "Maintenance Requested"),
    }

    if (previous.asset_status, doc.asset_status) not in allowed_changes:
        frappe.throw("Use an allowed asset workflow action.")

    current_values = doc.as_dict()
    previous_values = previous.as_dict()

    for field in doc.meta.fields:
        if field.fieldname in ("asset_status", "serial_number_required"):
            continue

        current_value = current_values.get(field.fieldname)
        previous_value = previous_values.get(field.fieldname)

        if field.fieldtype in ("Link", "Dynamic Link"):
            # Numeric link IDs can become integers during Frappe link validation.
            current_value = frappe.utils.cstr(current_value)
            previous_value = frappe.utils.cstr(previous_value)

        if current_value != previous_value:
            frappe.throw("Employees cannot change asset details.")


def location_query_conditions(user=None):
    """Employees may read only locations used by their own visible assets."""
    user = user or frappe.session.user
    roles = frappe.get_roles(user)
    if user == "Administrator" or any(
        role in roles for role in ("AssetsIQ IT", "System Manager")
    ):
        return ""
    if "AssetsIQ Employee" not in roles:
        return "1=0"
    return """
        `tabAsset Location`.`name` IN (
            SELECT `tabAsset`.`asset_location`
            FROM `tabAsset`
            WHERE {condition}
        )
    """.format(condition=asset_query_conditions(user))


def location_has_permission(doc, ptype=None, user=None):
    user = user or frappe.session.user
    roles = frappe.get_roles(user)
    if user == "Administrator" or any(
        role in roles for role in ("AssetsIQ IT", "System Manager")
    ):
        return True
    if "AssetsIQ Employee" not in roles or ptype not in (None, "read", "select"):
        return False
    if doc.is_new():
        return False
    return bool(frappe.db.exists("Asset", {
        "assigned_to": user,
        "asset_location": doc.name,
        "asset_status": ["in", [
            "Assignment Requested", "Assigned", "Maintenance Requested", "Under Maintenance",
        ]],
    }))
