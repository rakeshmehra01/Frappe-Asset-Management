"""Register the common AssetsIQ Home entry on the app launcher and desktop."""
import json
from pathlib import Path

import frappe


ROLES = {'AssetsIQ IT', 'AssetsIQ Employee', 'System Manager'}


def has_access():
    return bool(ROLES.intersection(frappe.get_roles()))


def setup_launcher():
    frappe.only_for('System Manager')
    icon = frappe.get_doc('Desktop Icon', 'AssetsIQ Home')
    if icon.app != 'assetsiq':
        raise ValueError('AssetsIQ Home icon ownership mismatch')
    layouts = frappe.get_all('Desktop Layout', fields=['name', 'user', 'layout'])
    backup = Path('/tmp/assetsiq-before-launcher.json')
    if not backup.exists():
        backup.write_text(frappe.as_json({'icon': icon.as_dict(), 'layouts': layouts}))
    try:
        icon.update({'icon_type': 'App', 'link_type': 'External', 'link': '/desk/assetsiq-home',
                     'logo_url': '/assets/assetsiq/images/assetsiq-mark.svg',
                     'parent_icon': None, 'link_to': None, 'hidden': 0})
        icon.save()
        updated = 0
        for row in layouts:
            if not ROLES.intersection(frappe.get_roles(row.user)):
                continue
            layout = json.loads(row.layout or '[]')
            if not isinstance(layout, list):
                raise ValueError('Unexpected desktop layout format')
            found = False
            for item in layout:
                if item.get('name') == icon.name or item.get('label') == icon.label:
                    item.update({key: icon.get(key) for key in ('name', 'label', 'app', 'standard', 'icon_type', 'link_type', 'link', 'logo_url', 'parent_icon', 'hidden')})
                    found = True
            if not found:
                entry = {key: icon.get(key) for key in ('name', 'label', 'app', 'standard', 'icon_type', 'link_type', 'link', 'logo_url', 'parent_icon', 'hidden', 'icon', 'bg_color')}
                entry['idx'] = max((int(item.get('idx') or 0) for item in layout), default=-1) + 1
                layout.append(entry)
            frappe.db.set_value('Desktop Layout', row.name, 'layout', json.dumps(layout))
            updated += 1
        frappe.db.commit()
        frappe.clear_cache()
    except Exception:
        frappe.db.rollback()
        raise
    return {'label': icon.label, 'route': icon.link, 'saved_layouts_updated': updated}
