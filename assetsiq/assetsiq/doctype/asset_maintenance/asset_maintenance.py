"""Maintenance request fields, ownership and repair-state validation."""
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cstr, get_datetime, now_datetime

OPEN_STATUSES = ('Requested', 'In Progress')
TRANSITIONS = {
    'Requested': {'In Progress', 'Rejected', 'Cancelled'},
    'In Progress': {'Completed', 'Cancelled'},
    'Completed': set(), 'Rejected': set(), 'Cancelled': set(),
}
EMPLOYEE_FIELDS = {'issue_title', 'issue_description', 'priority'}


def is_staff(user=None):
    user = user or frappe.session.user
    return user == 'Administrator' or bool({'AssetsIQ IT', 'System Manager'} & set(frappe.get_roles(user)))



@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def technician_query(doctype, txt, searchfield, start, page_len, filters=None):
    """Expose only technician names to IT, without granting access to User role tables."""
    if not is_staff() or not frappe.has_permission('Asset Maintenance', 'write'):
        frappe.throw(_('Only the IT team can select maintenance technicians.'), frappe.PermissionError)
    if doctype != 'User':
        frappe.throw(_('Invalid technician lookup.'))
    # This staff-only directory deliberately returns only enabled technician IDs
    # and display names. Role membership stays server-side.
    return frappe.get_all('User', fields=['name', 'full_name'],
        filters={'enabled': 1, 'user_type': 'System User',
                 'roles.role': ['in', ['AssetsIQ IT', 'System Manager']]},
        or_filters=[['name', 'like', '%' + cstr(txt)[:100] + '%'],
                    ['full_name', 'like', '%' + cstr(txt)[:100] + '%']],
        distinct=True, order_by='full_name asc, name asc',
        limit_start=max(0, min(frappe.utils.cint(start), 10000)),
        limit_page_length=max(1, min(frappe.utils.cint(page_len), 50)), as_list=True)


def query_conditions(user=None):
    user = user or frappe.session.user
    if is_staff(user):
        return ''
    if 'AssetsIQ Employee' not in frappe.get_roles(user):
        return '1=0'
    return '`tabAsset Maintenance`.`requested_by` = ' + frappe.db.escape(user)


def has_permission(doc, ptype=None, user=None):
    user = user or frappe.session.user
    if is_staff(user):
        return True
    if 'AssetsIQ Employee' not in frappe.get_roles(user):
        return False
    if doc.is_new():
        return ptype in (None, 'read', 'create', 'write')
    previous = frappe.db.get_value('Asset Maintenance', doc.name, ['requested_by', 'status'], as_dict=True)
    if not previous or previous.requested_by != user:
        return False
    if ptype in (None, 'read', 'select'):
        return True
    return ptype == 'write' and previous.status == 'Requested'


def same(field, left, right):
    if field.fieldtype in ('Datetime', 'Date'):
        return (get_datetime(left) if left else None) == (get_datetime(right) if right else None)
    if field.fieldtype in ('Link', 'Dynamic Link', 'Data', 'Small Text', 'Select'):
        return cstr(left) == cstr(right)
    return left == right


class AssetMaintenance(Document):
    def validate(self):
        user = frappe.session.user
        staff = is_staff(user)
        if not staff and 'AssetsIQ Employee' not in frappe.get_roles(user):
            frappe.throw(_('You do not have permission to manage maintenance requests.'), frappe.PermissionError)
        previous = self.get_doc_before_save()
        if not self.asset_name:
            frappe.throw(_('Select an asset for this maintenance request.'))

        if previous:
            for key in ('asset_name', 'asset_title', 'requested_by', 'requested_on', 'started_on', 'completed_on'):
                if not same(self.meta.get_field(key), self.get(key), previous.get(key)):
                    frappe.throw(_('The field {0} cannot be changed after the request is created.').format(self.meta.get_label(key)))
            if not staff:
                if previous.requested_by != user or previous.status != 'Requested':
                    frappe.throw(_('You can edit only your own requests while they are Requested.'), frappe.PermissionError)
                for field in self.meta.fields:
                    if field.fieldtype in frappe.model.no_value_fields or field.fieldname in EMPLOYEE_FIELDS:
                        continue
                    if not same(field, self.get(field.fieldname), previous.get(field.fieldname)):
                        frappe.throw(_('Only IT can change repair status, technician, dates or resolution.'), frappe.PermissionError)
        else:
            if self.requested_by and self.requested_by != user:
                frappe.throw(_('Requested By must be the logged-in user.'), frappe.PermissionError)
            if self.status not in (None, '', 'Requested'):
                frappe.throw(_('New maintenance requests must start as Requested.'))
            if not staff and any(self.get(field) for field in ('handled_by', 'scheduled_date', 'resolution_notes')):
                frappe.throw(_('Only IT can enter repair details.'), frappe.PermissionError)
            self.requested_by = user
            self.requested_on = now_datetime()
            self.status = 'Requested'
            self.started_on = None
            self.completed_on = None

        # Serialise saves for this asset so concurrent requests cannot both remain open.
        asset = frappe.db.get_value('Asset', self.asset_name,
            ['name', 'asset_name', 'asset_status', 'assigned_to'], as_dict=True, for_update=True)
        if not asset:
            frappe.throw(_('The selected asset does not exist.'))
        if not frappe.has_permission('Asset', 'read', doc=frappe.get_doc('Asset', self.asset_name)):
            frappe.throw(_('You do not have permission to read the selected asset.'), frappe.PermissionError)
        if not staff:
            if asset.assigned_to != user or asset.asset_status not in ('Assigned', 'Maintenance Requested'):
                frappe.throw(_('You can request maintenance only for your own assigned equipment.'), frappe.PermissionError)
        elif not previous and asset.asset_status not in ('Available', 'Assigned', 'Maintenance Requested', 'Under Maintenance'):
            frappe.throw(_('This asset is not eligible for a new maintenance request.'))
        if not previous:
            self.asset_title = asset.asset_name

        self.issue_title = cstr(self.issue_title).strip()
        self.issue_description = cstr(self.issue_description).strip()
        if not self.issue_title or not self.issue_description:
            frappe.throw(_('Enter an issue title and a description of the problem.'))
        if self.status not in TRANSITIONS:
            frappe.throw(_('Select a valid maintenance status.'))
        if previous and self.status != previous.status:
            if not staff:
                frappe.throw(_('Only IT can change maintenance status.'), frappe.PermissionError)
            if self.status not in TRANSITIONS.get(previous.status, set()):
                frappe.throw(_('This maintenance status transition is not allowed.'))
            if self.status == 'In Progress':
                self.started_on = now_datetime()
            elif self.status == 'Completed':
                self.completed_on = now_datetime()

        if self.handled_by:
            technician = frappe.db.get_value('User', self.handled_by, ['enabled', 'user_type'], as_dict=True)
            if not technician or not technician.enabled or technician.user_type != 'System User' or not is_staff(self.handled_by):
                frappe.throw(_('Handled By must be an enabled AssetsIQ IT or System Manager user.'))
        if self.status in ('In Progress', 'Completed') and not self.handled_by:
            frappe.throw(_('Select the IT user handling this maintenance request.'))
        if self.status in ('Completed', 'Rejected') and not cstr(self.resolution_notes).strip():
            frappe.throw(_('Enter resolution notes, or explain why this request was rejected.'))
        if self.status in OPEN_STATUSES:
            filters = {'asset_name': self.asset_name, 'status': ['in', list(OPEN_STATUSES)]}
            if previous:
                filters['name'] = ['!=', self.name]
            if frappe.db.get_value('Asset Maintenance', filters, 'name', for_update=True):
                frappe.throw(_('There is already an open maintenance request for this asset.'))
