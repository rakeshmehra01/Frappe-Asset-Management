"""Apply readable location titles without renaming any location records."""
from pathlib import Path

import frappe


def setup():
    frappe.only_for('System Manager')
    if frappe.db.get_value('DocType', 'Asset Location', 'module') != 'AssetsIQ':
        raise ValueError('Asset Location ownership mismatch')
    before = frappe.get_all('Asset Location', fields=['*'])
    backup = Path('/tmp/assetsiq-before-location-names.json')
    if not backup.exists():
        backup.write_text(frappe.as_json(before))
    frappe.reload_doc('assetsiq', 'doctype', 'asset_location')
    from assetsiq.assetsiq.doctype.asset_location.asset_location import suggest_location_name
    changed = []
    for row in frappe.get_all('Asset Location', fields=['name', 'location_name', 'address', 'country', 'state', 'district']):
        if not row.location_name:
            label = suggest_location_name(row)
            frappe.db.set_value('Asset Location', row.name, 'location_name', label, update_modified=False)
            changed.append({'id': row.name, 'location_name': label})
    frappe.db.commit()
    frappe.clear_cache(doctype='Asset Location')
    after = set(frappe.get_all('Asset Location', pluck='name'))
    assert after == {row.name for row in before}, 'Location IDs changed unexpectedly'
    return {'updated': changed, 'ids_preserved': True}


def verify():
    from assetsiq.assetsiq.doctype.asset_location.asset_location import suggest_location_name
    from frappe.desk.search import search_link
    meta = frappe.get_meta('Asset Location')
    assert meta.title_field == 'location_name' and meta.show_title_field_in_link
    docs = frappe.get_all('Asset Location', fields=['name', 'location_name'])
    assert all(d.location_name for d in docs)
    # Confirm search returns human-readable labels and retains link values.
    if docs:
        result = search_link('Asset Location', docs[0].location_name[:30], page_length=100)
        match = next((r for r in result if str(r['value']) == str(docs[0].name)), None)
        assert match and match.get('label') == docs[0].location_name, result
    assert suggest_location_name(frappe._dict(address='  Main   Office ', name='unused')) == 'Main Office'
    return {'title_field': meta.title_field, 'named_locations': len(docs), 'search_check': 'passed'}
