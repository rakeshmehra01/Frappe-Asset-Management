"""Transactional integration checks; all temporary requests and assets are rolled back."""
import uuid
import frappe
from frappe.client import get, get_list


def verify():
    frappe.only_for('System Manager')
    original_user = frappe.session.user
    original_test_flag = frappe.flags.in_test
    frappe.flags.in_test = True
    frappe.set_user('Administrator')
    snapshot = frappe.get_all('Asset', fields=['name', 'modified', 'assigned_to', 'asset_status'], order_by='name')
    request_count = frappe.db.count('Asset Maintenance')
    users = frappe.get_all('User', filters={'enabled': 1, 'user_type': 'System User'}, pluck='name')
    staff = next(user for user in users if user != 'Administrator' and 'AssetsIQ IT' in frappe.get_roles(user))
    employees = [user for user in users if 'AssetsIQ Employee' in frappe.get_roles(user)
                 and not {'AssetsIQ IT', 'System Manager'} & set(frappe.get_roles(user))]
    assert len(employees) >= 2, 'Need two Employee accounts for ownership checks'
    employee, other = employees[:2]
    sample = frappe.get_all('Asset', fields=['asset_category', 'asset_location'], limit_page_length=1)[0]
    counter = [0]
    fixture = uuid.uuid4().hex[:10]

    def denied(callback):
        counter[0] += 1
        point = 'maintenance_negative_' + str(counter[0])
        frappe.db.savepoint(point)
        try:
            callback()
        except (frappe.ValidationError, frappe.PermissionError):
            frappe.db.rollback(save_point=point)
            return
        frappe.db.rollback(save_point=point)
        raise AssertionError('Expected a permission or validation failure')

    def make_asset(owner, state='Assigned'):
        frappe.set_user('Administrator')
        doc = frappe.get_doc({'doctype': 'Asset', 'asset_name': 'TEST Maintenance ' + fixture,
            'asset_category': sample.asset_category, 'asset_location': sample.asset_location,
            'assigned_to': owner, 'serial_number': 'TEST-MAINT-' + uuid.uuid4().hex,
            'asset_status': 'Available'})
        doc.insert()
        # Seed only this temporary fixture without advancing any real device workflow.
        frappe.db.set_value('Asset', doc.name, 'asset_status', state)
        return doc.name

    def request(asset, **changes):
        return frappe.get_doc({'doctype': 'Asset Maintenance', 'asset_name': asset,
            'issue_title': 'TEST repair ' + fixture, 'issue_description': 'Keyboard needs repair.',
            'priority': 'Medium', **changes}).insert()

    def update(name, **changes):
        doc = frappe.get_doc('Asset Maintenance', name)
        doc.update(changes)
        return doc.save()

    try:
        own_asset = make_asset(employee)
        other_asset = make_asset(other)
        stock_asset = make_asset(None, 'Available')
        frappe.set_user(employee)
        own = request(own_asset)
        assert own.status == 'Requested' and own.requested_by == employee
        assert own.requested_on and own.asset_title.startswith('TEST Maintenance')
        assert own.name.startswith('AMT-')
        assert not own.started_on and not own.completed_on
        denied(lambda: request(own_asset))
        denied(lambda: request(other_asset))
        denied(lambda: request(stock_asset))
        denied(lambda: request(own_asset, requested_by=other))
        denied(lambda: request(own_asset, status='Completed'))
        own = update(own.name, issue_title='TEST corrected description ' + fixture, priority='High')
        assert own.priority == 'High'
        denied(lambda: update(own.name, asset_name=other_asset))
        denied(lambda: update(own.name, requested_by=other))
        # Field-level permission checks may reject or reset forged IT fields.
        try:
            update(own.name, status='In Progress', handled_by=staff, resolution_notes='Forged')
        except (frappe.ValidationError, frappe.PermissionError):
            pass
        saved = frappe.db.get_value('Asset Maintenance', own.name, ['status', 'handled_by', 'resolution_notes'], as_dict=True)
        assert saved.status == 'Requested' and not saved.handled_by and not saved.resolution_notes
        assert not frappe.has_permission('Asset Maintenance', 'delete', doc=frappe.get_doc('Asset Maintenance', own.name))
        assert not frappe.has_permission('Asset Maintenance', 'export')
        assert not frappe.has_permission('Asset Maintenance', 'share')

        frappe.set_user(other)
        denied(lambda: get('Asset Maintenance', own.name))
        assert not get_list('Asset Maintenance', filters={'name': own.name}, fields=['name'])
        other_request = request(other_asset)
        frappe.set_user(employee)
        denied(lambda: get('Asset Maintenance', other_request.name))
        names = {row.name for row in get_list('Asset Maintenance', fields=['name', 'requested_by'], limit_page_length=0)}
        assert own.name in names and other_request.name not in names
        own_read = get('Asset Maintenance', own.name)
        assert own_read.requested_by == employee

        frappe.set_user(staff)
        assert {own.name, other_request.name} <= {row.name for row in get_list('Asset Maintenance', fields=['name'], limit_page_length=0)}
        assert not frappe.has_permission('Asset Maintenance', 'delete', doc=frappe.get_doc('Asset Maintenance', own.name))
        denied(lambda: update(own.name, status='Completed', handled_by=staff, resolution_notes='Repair complete'))
        denied(lambda: update(own.name, status='In Progress'))
        denied(lambda: update(own.name, status='In Progress', handled_by=other))
        progress = update(own.name, status='In Progress', handled_by=staff)
        assert progress.started_on and not progress.completed_on
        started = progress.started_on
        frappe.set_user(employee)
        assert get('Asset Maintenance', own.name).status == 'In Progress'
        denied(lambda: update(own.name, issue_description='Changed after IT started'))
        frappe.set_user(staff)
        denied(lambda: update(own.name, status='Completed'))
        completed = update(own.name, status='Completed', resolution_notes='Keyboard replaced and tested.')
        assert completed.completed_on and completed.started_on == started
        denied(lambda: update(own.name, status='Requested'))
        rejected = update(other_request.name, status='Rejected', resolution_notes='Please provide the device for inspection.')
        assert rejected.status == 'Rejected'
        frappe.set_user(employee)
        assert get('Asset Maintenance', own.name).resolution_notes == 'Keyboard replaced and tested.'
        assert not frappe.has_permission('Asset Maintenance', 'write', doc=frappe.get_doc('Asset Maintenance', own.name))
        later = request(own_asset)
        assert later.name != own.name
        frappe.set_user(staff)
        update(later.name, status='Cancelled')
        denied(lambda: update(later.name, status='In Progress', handled_by=staff))

        from frappe.desk.search import search_link
        picker = 'assetsiq.assetsiq.doctype.asset_maintenance.asset_maintenance.technician_query'
        technicians = search_link('User', '', query=picker, reference_doctype='Asset Maintenance')
        assert technicians and all({'AssetsIQ IT', 'System Manager'} & set(frappe.get_roles(row['value'])) for row in technicians)

        frappe.set_user(employee)
        denied(lambda: search_link('User', '', query=picker, reference_doctype='Asset Maintenance'))

        frappe.set_user('Guest')
        denied(lambda: get_list('Asset Maintenance', fields=['name']))
        result = {'passed': True, 'employee_own_requests': True, 'cross_user_access_denied': True,
            'protected_fields_and_staff_controls': True, 'status_timestamps_and_required_resolution': True,
            'duplicate_open_requests_blocked': True, 'technician_picker': True}
    finally:
        frappe.db.rollback()
        frappe.set_user('Administrator')
        assert frappe.get_all('Asset', fields=['name', 'modified', 'assigned_to', 'asset_status'], order_by='name') == snapshot
        assert frappe.db.count('Asset Maintenance') == request_count
        frappe.flags.in_test = original_test_flag
        frappe.set_user(original_user)
    return {**result, 'temporary_records_rolled_back': True, 'existing_assets_unchanged': True}
