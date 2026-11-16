"""Install the personal dashboard in the existing My Workspace."""
import json
from pathlib import Path
import frappe

BLOCK = 'AssetsIQ My Workspace Dashboard'
ROLES = ('AssetsIQ IT', 'System Manager', 'AssetsIQ Employee')
MARKER = 'AssetsIQ employee dashboard, managed by assetsiq.setup.employee_dashboard'


def setup():
    frappe.only_for('System Manager')
    name = 'AssetsIQ — My Workspace'
    if not frappe.db.exists('Workspace', name):
        name = 'My Workspace'
    workspace = frappe.get_doc('Workspace', name)
    if workspace.app != 'assetsiq' or workspace.module != 'AssetsIQ':
        raise ValueError('Unexpected My Workspace ownership')
    block = frappe.get_doc('Custom HTML Block', BLOCK) if frappe.db.exists('Custom HTML Block', BLOCK) else frappe.new_doc('Custom HTML Block')
    if not block.is_new() and MARKER not in (block.html or ''):
        raise ValueError('An unrelated block already uses the dashboard name')
    backup = Path('/tmp/assetsiq-employee-dashboard/site-before.json')
    if not backup.exists():
        backup.parent.mkdir(parents=True, exist_ok=True)
        backup.write_text(frappe.as_json({'workspace': workspace.as_dict(), 'block': block.as_dict() if not block.is_new() else None}))
    block.name = BLOCK
    block.update({
        'private': 0,
        'html': Path(frappe.get_app_path('assetsiq', 'templates', 'includes', 'employee_dashboard.html')).read_text(),
        'style': '@import url("/assets/assetsiq/css/dashboard_common.css?v=5");',
        'script': 'frappe.require("/assets/assetsiq/js/employee_dashboard.js").then(() => {\n    frappe.assetsiq_employee_dashboard(root_element);\n});',
    })
    block.set('roles', [{'role': role} for role in ROLES])
    block.save()
    content = json.loads(workspace.content or '[]')
    starter_ids = {'aiq-welcome', 'aiq-introduction', 'aiq-my-assets', 'aiq-assignment-requests'}
    content = [row for row in content if row.get('id') not in starter_ids
               and not (row.get('type') == 'custom_block' and row.get('data', {}).get('custom_block_name') == BLOCK)]
    content.insert(0, {'id': 'aiq-employee-dashboard', 'type': 'custom_block', 'data': {'custom_block_name': BLOCK, 'col': 12}})
    workspace.content = json.dumps(content)
    if not any(row.custom_block_name == BLOCK for row in workspace.custom_blocks):
        workspace.append('custom_blocks', {'custom_block_name': BLOCK, 'label': BLOCK})
    workspace.save()
    frappe.db.commit()
    frappe.clear_cache()
    return {'workspace': name, 'block': BLOCK, 'stylesheet': 'dashboard_common.css', 'asset_records_changed': False}
