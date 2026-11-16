import frappe
from frappe import _

no_cache = 1
sitemap = 0


def get_context(context):
	user = frappe.session.user

	if user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=/assetsiq"
		raise frappe.Redirect(302)

	roles = set(frappe.get_roles(user))

	if user == "Administrator" or "AssetsIQ IT" in roles:
		workspace_name = _("IT workspace")
	elif "AssetsIQ Employee" in roles:
		workspace_name = _("Employee workspace")
	else:
		frappe.throw(
			_("You do not have access to AssetsIQ."),
			frappe.PermissionError,
		)

	context.title = "AssetsIQ"
	context.workspace_name = workspace_name
	context.display_name = frappe.get_cached_value("User", user, "full_name") or user
