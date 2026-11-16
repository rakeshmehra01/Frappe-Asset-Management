"""Identify AssetsIQ screens for the shared Desk navigation theme."""

import frappe


def extend_bootinfo(bootinfo):
    """Expose route names only; native permissions still control access."""
    modules = frappe.get_all("Module Def", filters={"app_name": "assetsiq"}, pluck="name")
    routes = {"doctypes": [], "workspaces": [], "pages": [], "reports": []}
    if modules:
        for key, doctype in (
            ("doctypes", "DocType"),
            ("workspaces", "Workspace"),
            ("pages", "Page"),
        ):
            routes[key] = frappe.get_all(doctype, filters={"module": ["in", modules]}, pluck="name")
        # Include reports belonging to this app, including reports on its DocTypes.
        routes["reports"] = frappe.get_all(
            "Report",
            or_filters={"module": ["in", modules], "ref_doctype": ["in", routes["doctypes"]]},
            pluck="name",
        )
    bootinfo.assetsiq_routes = routes
