"""Make existing Asset workflow requests reachable from their workspaces."""
import json
from pathlib import Path

import frappe


def setup():
    frappe.only_for('System Manager')
    names = ('AssetsIQ — IT Operations', 'AssetsIQ — My Workspace')
    workspaces = [frappe.get_doc('Workspace', name) for name in names]
    if any(w.app != 'assetsiq' for w in workspaces):
        raise ValueError('Workspace ownership mismatch')
    backup = Path('/tmp/assetsiq-before-asset-navigation.json')
    if not backup.exists():
        backup.write_text(frappe.as_json({'workspaces':[w.as_dict() for w in workspaces],
                                         'asset_meta':frappe.get_doc('DocType','Asset').as_dict()}))
    frappe.reload_doc('assetsiq', 'doctype', 'asset')
    for workspace in workspaces:
        mine = workspace.name.endswith('My Workspace')
        desired = [
            ('My Assets', '[["Asset","assigned_to","=",frappe.session.user]]'),
            ('Assignment Requests', '[["Asset","assigned_to","=",frappe.session.user],["Asset","asset_status","=","Assignment Requested"]]'),
        ] if mine else [('Assets', '')]
        content = json.loads(workspace.content or '[]')
        for label, filters in desired:
            shortcut = next((s for s in workspace.shortcuts if s.label == label), None)
            if shortcut is None:
                shortcut = workspace.append('shortcuts', {})
            shortcut.update({'label':label,'type':'DocType','link_to':'Asset','doc_view':'List','stats_filter':filters,'icon':'list','color':'Violet'})
            if not any(b.get('type')=='shortcut' and b.get('data',{}).get('shortcut_name')==label for b in content):
                content.append({'id':'aiq-'+frappe.scrub(label).replace('_','-'), 'type':'shortcut',
                                'data':{'shortcut_name':label,'col':6 if mine else 3}})
        workspace.content = json.dumps(content)
        workspace.save()
    frappe.db.commit()
    frappe.clear_cache()
    return {'status_columns':1,'my_workspace_shortcuts':['My Assets','Assignment Requests'],
            'it_workspace_shortcuts':['Assets'],'asset_records_changed':False}
