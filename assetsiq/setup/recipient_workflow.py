"""Let IT recipients confirm their own devices, without approving for others."""
from pathlib import Path
import frappe

RECIPIENT_ACTIONS = {
    'Accept Assignment': ('Assignment Requested', 'Assigned'),
    'Decline Assignment': ('Assignment Requested', 'Available'),
    'Request Maintenance': ('Assigned', 'Maintenance Requested'),
}
CONDITION = 'doc.assigned_to == frappe.session.user'


def setup():
    frappe.only_for('System Manager')
    name = frappe.db.get_value('Workflow', {'document_type':'Asset','is_active':1}, 'name')
    if not name:
        raise ValueError('No active Asset workflow')
    workflow = frappe.get_doc('Workflow', name)
    if workflow.workflow_state_field != 'asset_status':
        raise ValueError('Unexpected Asset workflow state field')
    originals = []
    for action, (state, next_state) in RECIPIENT_ACTIONS.items():
        rows = [t for t in workflow.transitions if t.action == action]
        employee = [t for t in rows if t.allowed == 'AssetsIQ Employee']
        it = [t for t in rows if t.allowed == 'AssetsIQ IT']
        if len(employee) != 1 or len(it) > 1 or len(rows) != len(employee) + len(it):
            raise ValueError(f'Review duplicate, missing, or unexpected roles on {action}')
        for row in rows:
            if (row.state,row.next_state)!=(state,next_state) or (row.condition or '').strip()!=CONDITION:
                raise ValueError(f'Review recipient condition and states for {action}')
        originals.append((employee[0],bool(it)))
    backup=Path('/tmp/assetsiq-before-recipient-workflow.json')
    if not backup.exists():
        backup.write_text(frappe.as_json(workflow.as_dict()))
    created=[]
    for row,exists in originals:
        if not exists:
            workflow.append('transitions',{
                'state':row.state,'action':row.action,'next_state':row.next_state,
                'allowed':'AssetsIQ IT','condition':CONDITION,
                'allow_self_approval':row.allow_self_approval,
            })
            created.append(row.action)
    if created:
        workflow.save()
        frappe.db.commit()
        frappe.clear_cache(doctype='Asset')
    return {'workflow':workflow.name,'it_recipient_actions_added':created,
            'recipient_condition_preserved':True,'employee_rules_preserved':True,
            'it_management_rules_unchanged':True,'asset_records_changed':False}
