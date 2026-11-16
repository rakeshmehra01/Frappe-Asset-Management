"""Repeatable setup for AssetsIQ's two role-specific Desk Workspaces."""

import json
from urllib.parse import quote

import frappe
from frappe import _
from frappe.utils import get_url_to_workspace


APP_ROLES = ("AssetsIQ Employee", "AssetsIQ IT")
EMPLOYEE_WORKSPACE = "AssetsIQ — My Workspace"
IT_WORKSPACE = "AssetsIQ — IT Operations"
ENTRY_DOCTYPES = ("Workspace", "Workspace Sidebar", "Desktop Icon")


def _check_app_ownership(doctype, name):
	if frappe.db.exists(doctype, name):
		if frappe.db.get_value(doctype, name, "app") != "assetsiq":
			frappe.throw(_("The {0} named {1} belongs to another app.").format(doctype, name))


def _create_if_missing(doctype, name, values):
	_check_app_ownership(doctype, name)
	if frappe.db.exists(doctype, name):
		return frappe.get_doc(doctype, name)
	return frappe.get_doc({"doctype": doctype, **values}).insert()


def _set_role(doc, role):
	roles = ["AssetsIQ IT", "System Manager"]
	if role == "AssetsIQ Employee":
		roles.append("AssetsIQ Employee")
	if [row.role for row in doc.roles] != roles:
		doc.set("roles", [{"role": name} for name in roles])
		doc.save()


def _content(heading, description):
	return json.dumps(
		[
			{
				"id": "aiq-welcome",
				"type": "header",
				"data": {"text": f'<span class="h2">{heading}</span>', "col": 12},
			},
			{
				"id": "aiq-introduction",
				"type": "paragraph",
				"data": {"text": description, "col": 12},
			},
		]
	)


def _adapt_shared_entry():
	"""Preserve linked records while replacing the old shared landing entry."""
	for doctype in ENTRY_DOCTYPES:
		if not frappe.db.exists(doctype, "AssetsIQ"):
			continue
		frappe.rename_doc(
			doctype,
			"AssetsIQ",
			IT_WORKSPACE,
			show_alert=False,
			rebuild_search=False,
		)
		if doctype == "Workspace":
			doc = frappe.get_doc(doctype, IT_WORKSPACE)
			doc.title = IT_WORKSPACE
			# Update only the original welcome blocks; preserve any added widgets.
			blocks = json.loads(doc.content)
			for block in blocks:
				if block.get("id") == "aiq-welcome":
					block["data"]["text"] = '<span class="h2">IT Operations</span>'
				elif block.get("id") == "aiq-introduction":
					block["data"]["text"] = (
						"Manage hardware inventory, employee requests, assignments, "
						"maintenance, returns and transfers across the organisation."
					)
			doc.content = json.dumps(blocks)
			doc.save()


def setup_role_workspaces():
	"""Run with bench execute; no business records or sample widgets are created."""
	frappe.only_for("System Manager")
	if frappe.db.get_value("Module Def", "AssetsIQ", "app_name") != "assetsiq":
		frappe.throw(_("The AssetsIQ module must belong to the assetsiq app."))

	for role_name in APP_ROLES:
		if not frappe.db.exists("Role", role_name):
			frappe.throw(_("Create the role {0} before setting up the workspaces.").format(role_name))

	# Preflight every entry before applying renames or changing role settings.
	for doctype in ENTRY_DOCTYPES:
		for name in ("AssetsIQ", EMPLOYEE_WORKSPACE, IT_WORKSPACE):
			_check_app_ownership(doctype, name)
		if frappe.db.exists(doctype, "AssetsIQ") and frappe.db.exists(doctype, IT_WORKSPACE):
			frappe.throw(_("Both the old and new {0} exist. Review them before continuing.").format(doctype))

	for role_name in APP_ROLES:
		role = frappe.get_doc("Role", role_name)
		if not role.desk_access:
			role.desk_access = 1
			role.save()

	_adapt_shared_entry()

	result = []
	for name, heading, role, description in (
		(
			EMPLOYEE_WORKSPACE,
			"My Workspace",
			"AssetsIQ Employee",
			"Your assigned equipment, your requests and updates from the IT team in one place.",
		),
		(
			IT_WORKSPACE,
			"IT Operations",
			"AssetsIQ IT",
			"Manage hardware inventory, employee requests, assignments, maintenance, "
			"returns and transfers across the organisation.",
		),
	):
		workspace = _create_if_missing(
			"Workspace",
			name,
			{
				"label": name,
				"title": name,
				"module": "AssetsIQ",
				"app": "assetsiq",
				"type": "Workspace",
				"public": 1,
				"is_hidden": 0,
				"icon": "grid",
				"indicator_color": "cyan",
				"roles": [{"role": role}],
				"content": _content(heading, description),
			},
		)
		_set_role(workspace, role)

		sidebar = _create_if_missing(
			"Workspace Sidebar",
			name,
			{
				"title": name,
				"app": "assetsiq",
				"module": "AssetsIQ",
				"standard": 1,
				"header_icon": "grid",
				"items": [
					{
						"label": "Home",
						"type": "Link",
						"link_type": "Workspace",
						"link_to": workspace.name,
						"icon": "grid",
					}
				],
			},
		)

		icon = _create_if_missing(
			"Desktop Icon",
			name,
			{
				"label": name,
				"app": "assetsiq",
				"standard": 1,
				"icon_type": "Link",
				"icon": "grid",
				"bg_color": "blue",
				"link_type": "Workspace Sidebar",
				"link_to": sidebar.name,
				"sidebar": sidebar.name,
				"roles": [{"role": role}],
			},
		)
		_set_role(icon, role)
		result.append(
			{"workspace": name, "role": role, "route": quote(get_url_to_workspace(name, True), safe="/")}
		)

	frappe.clear_cache()
	return result


def setup_workspace():
	"""Compatibility entry point: never recreate the superseded shared Workspace."""
	return setup_role_workspaces()
