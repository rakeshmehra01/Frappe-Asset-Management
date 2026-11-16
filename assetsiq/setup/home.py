"""Install one role-aware AssetsIQ Home entry without deleting workspaces."""
import json
from pathlib import Path

import frappe


HOME_ROLES = ('AssetsIQ IT', 'AssetsIQ Employee', 'System Manager')


def setup_home():
    frappe.only_for('System Manager')
    if frappe.db.get_value('Module Def', 'AssetsIQ', 'app_name') != 'assetsiq':
        raise ValueError('AssetsIQ module ownership mismatch')
    existing = []
    targets = [('Page', 'assetsiq-home'), ('Workspace Sidebar', 'AssetsIQ Home'),
               ('Desktop Icon', 'AssetsIQ Home')]
    for name in ('AssetsIQ — IT Operations', 'AssetsIQ — My Workspace'):
        targets.extend([('Workspace', name), ('Desktop Icon', name)])
    for doctype, name in targets:
        if frappe.db.exists(doctype, name):
            doc = frappe.get_doc(doctype, name)
            if doctype == 'Page':
                if doc.module != 'AssetsIQ':
                    raise ValueError('Home Page ownership mismatch')
            elif doc.app != 'assetsiq':
                raise ValueError(f'Unexpected ownership: {doctype} {name}')
            existing.append(doc.as_dict())
    backup = Path('/tmp/assetsiq-before-common-home.json')
    if not backup.exists():
        backup.write_text(frappe.as_json(existing))
    try:
        page = frappe.get_doc('Page', 'assetsiq-home') if frappe.db.exists('Page', 'assetsiq-home') else frappe.new_doc('Page')
        page.update({'page_name': 'assetsiq-home', 'title': 'AssetsIQ Home', 'module': 'AssetsIQ', 'standard': 'Yes'})
        page.set('roles', [{'role': role} for role in HOME_ROLES])
        page.save()
        sidebar = frappe.get_doc('Workspace Sidebar', 'AssetsIQ Home') if frappe.db.exists('Workspace Sidebar', 'AssetsIQ Home') else frappe.new_doc('Workspace Sidebar')
        sidebar.update({'title': 'AssetsIQ Home', 'module': 'AssetsIQ', 'app': 'assetsiq', 'standard': 1, 'header_icon': 'home'})
        sidebar.set('items', [{'label': 'Home', 'type': 'Link', 'link_type': 'Page', 'link_to': 'assetsiq-home', 'icon': 'home'}])
        sidebar.save()
        icon = frappe.get_doc('Desktop Icon', 'AssetsIQ Home') if frappe.db.exists('Desktop Icon', 'AssetsIQ Home') else frappe.new_doc('Desktop Icon')
        icon.update({'label': 'AssetsIQ Home', 'app': 'assetsiq', 'standard': 1, 'icon_type': 'App',
                     'link_type': 'External', 'link': '/desk/assetsiq-home',
                     'logo_url': '/assets/assetsiq/images/assetsiq-mark.svg',
                     'link_to': None, 'sidebar': sidebar.name,
                     'icon': 'home', 'hidden': 0, 'bg_color': 'blue'})
        icon.set('roles', [{'role': role} for role in HOME_ROLES])
        icon.save()
        for name in ('AssetsIQ — IT Operations', 'AssetsIQ — My Workspace'):
            workspace = frappe.get_doc('Workspace', name)
            roles = ['AssetsIQ IT', 'System Manager']
            if name.endswith('My Workspace'):
                roles.append('AssetsIQ Employee')
            workspace.set('roles', [{'role': role} for role in roles])
            workspace.save()
            if frappe.db.exists('Desktop Icon', name):
                old_icon = frappe.get_doc('Desktop Icon', name)
                old_icon.hidden = 1
                old_icon.save()
        frappe.db.commit()
        frappe.clear_cache()
    except Exception:
        frappe.db.rollback()
        raise
    return {'home_route': '/desk/assetsiq-home', 'desktop_entry': icon.name,
            'it_workspaces': 2, 'employee_workspaces': 1, 'backup': str(backup)}
