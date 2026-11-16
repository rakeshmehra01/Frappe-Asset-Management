"""Import GeoNames ADM2 names under existing Location State records.

Source: https://download.geonames.org/export/dump/ (CC BY 4.0).
Bench-only, additive, repeatable; never creates states or overwrites records.
"""
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import frappe


def _rows(path):
    rows = []
    codes = set()
    for number, row in enumerate(csv.reader(Path(path).open(encoding='utf-8-sig'), delimiter='\t'), 1):
        if not row:
            continue
        if len(row) != 4 or not row[0] or not row[1].strip() or not row[3].isdigit():
            raise ValueError(f'Invalid GeoNames row {number} in {path}')
        if row[0] in codes:
            raise ValueError(f'Duplicate administrative code: {row[0]}')
        codes.add(row[0])
        rows.append((row[0], ' '.join(row[1].split()), row[3]))
    if not rows:
        raise ValueError('Empty source file')
    return rows


def import_location_districts(state_source, district_source, report_path, dry_run=True):
    frappe.only_for('System Manager')
    for doctype in ('Location State', 'Location District'):
        if frappe.db.get_value('DocType', doctype, 'module') != 'AssetsIQ':
            raise ValueError(f'{doctype} must belong to AssetsIQ')
    states = frappe.get_all('Location State', fields=['name', 'state_name', 'country'])
    countries = {c.name: (c.code or '').upper() for c in frappe.get_all('Country', fields=['name', 'code'])}
    by_label = defaultdict(list)
    for state in states:
        by_label[(countries.get(state.country), state.state_name.strip().casefold())].append(state.name)
    mapped = {}
    for code, label, _ in _rows(state_source):
        matches = by_label.get((code.split('.')[0], label.casefold()), [])
        if len(matches) > 1:
            raise ValueError(f'Ambiguous existing state: {code} {label}')
        if matches:
            mapped[code] = matches[0]
    existing = {(d.state, d.district_name.casefold()) for d in frappe.get_all('Location District', fields=['state', 'district_name'])}
    report = {'source': 'GeoNames', 'license': 'CC BY 4.0',
              'source_url': 'https://download.geonames.org/export/dump/admin2Codes.txt',
              'run_at_utc': datetime.now(timezone.utc).isoformat(), 'dry_run': dry_run,
              'sha256': {str(p): hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in (state_source, district_source)},
              'created': [], 'unmatched_source_parents': [], 'existing_preserved': 0,
              'would_create': 0, 'source_duplicate_names': 0}
    coverage = Counter()
    seen = set()
    try:
        for code, label, geoname_id in _rows(district_source):
            parent = code.rsplit('.', 1)[0]
            state_id = mapped.get(parent)
            if not state_id:
                report['unmatched_source_parents'].append({'code': code, 'district_name': label})
                continue
            if len(label) > 140:
                raise ValueError(f'District name too long: {code}')
            coverage[state_id] += 1
            pair = (state_id, label.casefold())
            if pair in seen:
                report['source_duplicate_names'] += 1
                continue
            seen.add(pair)
            if pair in existing or frappe.db.exists('Location District', {'state': state_id, 'district_name': label}):
                report['existing_preserved'] += 1
                continue
            if dry_run:
                report['would_create'] += 1
            else:
                doc = frappe.get_doc({'doctype': 'Location District', 'state': state_id, 'district_name': label}).insert()
                report['created'].append({'name': doc.name, 'state': state_id, 'district_name': label, 'admin_code': code, 'geoname_id': geoname_id})
                if len(report['created']) % 2000 == 0:
                    print(f"Created {len(report['created'])} districts", flush=True)
        report['states_without_source_districts'] = [dict(s) for s in states if s.name not in coverage]
        report['covered_states'] = len(coverage)
        report['existing_states'] = len(states)
        Path(report_path).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        if not dry_run:
            frappe.db.commit()
    except Exception as exc:
        print(f'Import failed: {type(exc).__name__}: {exc}', flush=True)
        frappe.db.rollback()
        raise
    return {k: len(v) if isinstance(v, list) else v for k, v in report.items() if k not in ('sha256',)}
