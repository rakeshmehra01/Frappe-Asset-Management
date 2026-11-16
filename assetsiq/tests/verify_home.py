"""Read-only checks against the installed native workspace access rules."""
from types import SimpleNamespace
from unittest.mock import patch

import frappe
from frappe.desk.desktop import Workspace


def verify():
    expected = {
        'AssetsIQ IT': ['AssetsIQ — IT Operations', 'AssetsIQ — My Workspace'],
        'AssetsIQ Employee': ['AssetsIQ — My Workspace'],
    }
    actual = {}
    for role, names in expected.items():
        permitted = []
        with patch('frappe.get_roles', return_value=[role]), patch('frappe.desk.desktop.get_custom_allowed_roles', return_value=[]):
            for name in ('AssetsIQ — IT Operations', 'AssetsIQ — My Workspace'):
                obj = SimpleNamespace(doc=frappe.get_doc('Workspace', name))
                if Workspace.is_permitted(obj):
                    permitted.append(name)
        assert permitted == names, (role, permitted)
        actual[role] = permitted
    for name in ('AssetsIQ — IT Operations', 'AssetsIQ — My Workspace'):
        assert frappe.db.get_value('Desktop Icon', name, 'hidden') == 1
    icon = frappe.get_doc('Desktop Icon', 'AssetsIQ Home')
    assert icon.hidden == 0 and icon.link == '/desk/assetsiq-home' and icon.icon_type == 'App'
    sidebar = frappe.get_doc('Workspace Sidebar', 'AssetsIQ Home')
    assert sidebar.items[0].link_to == 'assetsiq-home'
    page = frappe.get_doc('Page', 'assetsiq-home')
    assert {'AssetsIQ IT', 'AssetsIQ Employee'} <= {r.role for r in page.roles}
    return {'role_checks': actual, 'common_desktop_entry': icon.name, 'passed': True}
