import ast
import runpy
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

class Denied(Exception):
    pass

def deny(message):
    raise Denied(message)

path = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parents[1] / 'asset_permissions.py')
ast.parse(Path(path).read_text())
frappe=SimpleNamespace(session=SimpleNamespace(user='employee@example.test'),
    get_roles=Mock(return_value=['AssetsIQ Employee']),throw=deny,
    utils=SimpleNamespace(cstr=lambda value: '' if value is None else str(value)))
sys.modules['frappe']=frappe
check=runpy.run_path(path)['validate_employee_asset_changes']
fields={'asset_status':'Select','serial_number_required':'Check','asset_name':'Data',
        'asset_location':'Link','assigned_to':'Link','asset_category':'Link','serial_number':'Data','description':'Small Text'}

def document(old='Assignment Requested',new='Assigned',owner='employee@example.test',edits=None,existing=True):
    values={'asset_status':old,'serial_number_required':1,'asset_name':'Laptop','asset_location':'8',
            'assigned_to':owner,'asset_category':'Laptop','serial_number':'ABC123','description':'Equipment'}
    previous=SimpleNamespace(asset_status=old,assigned_to=owner,as_dict=lambda:values.copy()) if existing else None
    current={**values,'asset_status':new,**(edits or {})}
    return SimpleNamespace(get_doc_before_save=lambda:previous,as_dict=lambda:current.copy(),asset_status=new,
        meta=SimpleNamespace(fields=[SimpleNamespace(fieldname=f,fieldtype=t) for f,t in fields.items()]))

def rejected(doc):
    try:
        check(doc)
    except Denied:
        return
    raise AssertionError('Unauthorized change was allowed')

for old,new in [('Assignment Requested','Assigned'),('Assignment Requested','Available'),('Assigned','Maintenance Requested')]:
    check(document(old,new))
    check(document(old,new,edits={'asset_location':8}))
    rejected(document(old,new,edits={'asset_location':9}))
    for field in ('asset_name','assigned_to','asset_category','serial_number','description'):
        rejected(document(old,new,edits={field:'tampered'}))
rejected(document(owner='another@example.test'))
rejected(document(existing=False))
rejected(document('Assigned','Retired'))
rejected(document('Assigned','Assigned'))
for roles in (['AssetsIQ IT'],['System Manager'],['AssetsIQ IT','AssetsIQ Employee']):
    frappe.get_roles.return_value=roles
    check(document('Assigned','Retired',owner='other@example.test'))
print('Passed: numeric Link normalization, changed location rejection, protected details, own-asset actions and IT bypass.')
