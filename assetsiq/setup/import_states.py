"""Import GeoNames first-level divisions into Location State without overwrites.

GeoNames data: CC BY 4.0, https://www.geonames.org/
Source and attribution are kept beside the downloaded dataset in planning.
"""

import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import frappe
from frappe import _


SOURCE_URL = "https://download.geonames.org/export/dump/admin1CodesASCII.txt"


def _read_source(source_path):
	path = Path(source_path).expanduser().resolve()
	rows = []
	seen_codes = set()
	with path.open(encoding="utf-8-sig", newline="") as source:
		for line, row in enumerate(csv.reader(source, delimiter="\t"), start=1):
			if not row:
				continue
			if len(row) != 4:
				raise ValueError(f"Invalid GeoNames row {line}: expected four columns.")
			code, name, ascii_name, geoname_id = row
			country_code, separator, subdivision = code.partition(".")
			name = " ".join(name.split())
			if not (separator and len(country_code) == 2 and country_code.isalpha()
				and subdivision and name and len(name) <= 140 and geoname_id.isdigit()):
				raise ValueError(f"Invalid geographic values on row {line}.")
			if code in seen_codes:
				raise ValueError(f"Repeated administrative code on row {line}: {code}")
			seen_codes.add(code)
			rows.append({"country_code": country_code.upper(), "state_name": name,
				"admin_code": code, "geoname_id": geoname_id})
	if not rows:
		raise ValueError("The geographic source file contains no records.")
	return rows, hashlib.sha256(path.read_bytes()).hexdigest()


def import_location_states(source_path, report_path=None, dry_run=True):
	"""Bench-only helper. Match countries by ISO code and skip existing pairs.

	No schema, existing states, districts, or location records are changed.
	A real run commits only after every source row has been handled successfully.
	"""
	frappe.only_for("System Manager")
	if frappe.db.get_value("Module Def", "AssetsIQ", "app_name") != "assetsiq":
		frappe.throw(_("Review AssetsIQ module ownership before importing."))
	if frappe.db.get_value("DocType", "Location State", "module") != "AssetsIQ":
		frappe.throw(_("Location State must belong to AssetsIQ."))

	rows, source_hash = _read_source(source_path)
	countries = frappe.get_all("Country", fields=["name", "code"], order_by="name")
	by_code = {}
	for country in countries:
		code = (country.code or "").upper().strip()
		if not code:
			continue
		if code in by_code:
			frappe.throw(_("Country code {0} is not unique. Resolve it before importing.").format(code))
		by_code[code] = country.name

	unmatched = sorted({row["country_code"] for row in rows} - by_code.keys())
	if unmatched:
		frappe.throw(_("No Country records match these source codes: {0}").format(", ".join(unmatched)))

	coverage = Counter(row["country_code"] for row in rows)
	report = {
		"source": "GeoNames", "source_url": SOURCE_URL, "license": "CC BY 4.0",
		"source_sha256": source_hash, "source_rows": len(rows),
		"run_at_utc": datetime.now(timezone.utc).isoformat(), "dry_run": bool(dry_run),
		"existing_country_records": len(countries), "covered_countries": len(coverage),
		"countries_without_source_divisions": [
			{"country": country.name, "code": country.code}
			for country in countries if (country.code or "").upper() not in coverage
		],
		"coverage": [{"country": by_code[code], "code": code, "source_divisions": count}
			for code, count in sorted(coverage.items(), key=lambda item: by_code[item[0]])],
		"created": [], "existing": [], "would_create": 0,
	}
	try:
		for index, row in enumerate(rows, start=1):
			values = {"country": by_code[row["country_code"]], "state_name": row["state_name"]}
			existing = frappe.db.get_value("Location State", values, "name")
			if existing:
				report["existing"].append({"name": existing, **values, "admin_code": row["admin_code"]})
			elif dry_run:
				report["would_create"] += 1
			else:
				doc = frappe.get_doc({"doctype": "Location State", **values}).insert()
				report["created"].append({"name": doc.name, **values,
					"admin_code": row["admin_code"], "geoname_id": row["geoname_id"]})
			if index % 500 == 0:
				print(f"Checked {index}/{len(rows)} source divisions", flush=True)

		if report_path:
			target = Path(report_path).expanduser().resolve()
			target.parent.mkdir(parents=True, exist_ok=True)
			target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
		if not dry_run:
			frappe.db.commit()
			frappe.clear_cache(doctype="Location State")
	except Exception:
		if not dry_run:
			frappe.db.rollback()
		raise
	return {
		"dry_run": bool(dry_run), "source_rows": len(rows),
		"countries": len(coverage), "created": len(report["created"]),
		"existing_preserved": len(report["existing"]), "would_create": report["would_create"],
		"countries_without_source_divisions": len(report["countries_without_source_divisions"]),
		"report_path": str(Path(report_path).resolve()) if report_path else None,
	}
