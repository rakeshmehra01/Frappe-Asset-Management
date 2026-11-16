"""Read-only checks for My Workspace ownership and native permissions."""
import json
import frappe
from frappe.client import get_list

ACTIVE = ['Assignment Requested', 'Assigned', 'Maintenance Requested', 'Under Maintenance']


def verify(check_install=True):
    frappe.only_for('System Manager')
    original_user = frappe.session.user
    frappe.set_user('Administrator')
    snapshot = frappe.get_all('Asset', fields=['name', 'modified', 'asset_status', 'assigned_to'], order_by='name')
    users = frappe.get_all('User', filters={'enabled': 1, 'user_type': 'System User'}, pluck='name')
    staff = next(user for user in users if user != 'Administrator' and 'AssetsIQ IT' in frappe.get_roles(user))
    employees = [user for user in users if 'AssetsIQ Employee' in frappe.get_roles(user)
                 and not {'AssetsIQ IT', 'System Manager'} & set(frappe.get_roles(user))]
    assert employees, 'Need an Employee account for permission verification'
    results = []
    try:
        if check_install:
            workspace = frappe.get_doc('Workspace', 'AssetsIQ — My Workspace')
            block = frappe.get_doc('Custom HTML Block', 'AssetsIQ My Workspace Dashboard')
            assert 'employee_dashboard.js' in block.script and '.js?' not in block.script
            assert 'dashboard_common.css?v=5' in block.style
            assert {r.role for r in block.roles} == {'AssetsIQ IT', 'AssetsIQ Employee', 'System Manager'}
            assert sum(row.get('type') == 'custom_block' and row.get('data', {}).get('custom_block_name') == block.name for row in json.loads(workspace.content)) == 1
        for label, user in [('Administrator', 'Administrator'), ('IT', staff)] + [('Employee', user) for user in employees[:2]]:
            frappe.set_user(user)
            filters = {'assigned_to': user, 'asset_status': ['in', ACTIVE]}
            rows = get_list('Asset', fields=['name', 'asset_status', 'assigned_to', 'asset_category', 'asset_location', 'asset_location.location_name as location_label'], filters=filters, limit_page_length=0)
            assert all(row.assigned_to == user and row.asset_status in ACTIVE for row in rows)
            groups = get_list('Asset', fields=['asset_status', {'COUNT': '*', 'as': 'total'}], filters=filters, group_by='asset_status', order_by='', limit_page_length=0)
            assert sum(int(row.total) for row in groups) == len(rows)
            categories = get_list('Asset', fields=['asset_category', {'COUNT': '*', 'as': 'total'}], filters=filters, group_by='asset_category', order_by='total desc, asset_category asc', limit_page_length=0)
            assert sum(int(row.total) for row in categories) == len(rows)
            count = get_list('Asset', fields=[{'COUNT': '*', 'as': 'total'}], filters=filters, order_by='', limit_page_length=1)
            assert int(count[0].total) == len(rows)
            recent = get_list('Asset', fields=['name', 'asset_name', 'asset_status', 'modified'], filters=filters, order_by='modified desc, name desc', limit_page_length=3)
            assert {row.name for row in recent} <= {row.name for row in rows}
            for status in ACTIVE:
                result = get_list('Asset', fields=['name', 'assigned_to'], filters={'assigned_to': user, 'asset_status': status}, limit_page_length=0)
                assert {row.name for row in result} == {row.name for row in rows if row.asset_status == status}
            for row in rows:
                if row.asset_location:
                    assert row.get('location_label') == frappe.db.get_value('Asset Location', row.asset_location, 'location_name')
            if rows:
                term = rows[0].name
                search = get_list('Asset', fields=['name'], filters=filters,
                                  or_filters=[[field, 'like', '%' + term + '%'] for field in ('name', 'asset_name', 'serial_number')], limit_page_length=5)
                assert search and {r.name for r in search} <= {r.name for r in rows}
            other = next((row for row in snapshot if row.assigned_to != user), None)
            if other:
                assert not get_list('Asset', fields=['name'], filters={**filters, 'name': other.name}, limit_page_length=5)
            if check_install:
                from frappe.desk.desktop import get_desktop_page
                data = get_desktop_page(json.dumps({'name': 'AssetsIQ — My Workspace', 'title': workspace.title, 'public': 1}))
                assert any(row.custom_block_name == block.name for row in data['custom_blocks']['items'])
            results.append({'role': label, 'personal_assets': len(rows), 'counts_categories_search_and_ownership': 'passed'})
        frappe.set_user('Guest')
        try:
            get_list('Asset', fields=['name'], filters={'assigned_to': 'Guest'})
        except frappe.PermissionError:
            pass
        else:
            raise AssertionError('Guest can read assets')
        frappe.set_user('Administrator')
        assert frappe.get_all('Asset', fields=['name', 'modified', 'asset_status', 'assigned_to'], order_by='name') == snapshot
        return {'passed': True, 'checks': results, 'guest_denied': True, 'assets_unchanged': True}
    finally:
        frappe.set_user(original_user)
