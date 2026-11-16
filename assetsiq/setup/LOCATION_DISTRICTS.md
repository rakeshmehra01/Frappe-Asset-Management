# Location District setup

The Location District list and full form use the AssetsIQ lavender theme. Native
filters, permissions, sorting, document links and save actions remain available.
The list hides generated IDs and displays District Name as its title.

## How names were added

Source: GeoNames, CC BY 4.0, https://download.geonames.org/export/dump/ .
`admin1CodesASCII.txt` identifies states; `admin2Codes.txt` supplies second-level
administrative areas (districts, counties, municipalities and equivalents).
These are geographic reference names, not an assertion of complete official coverage.

The importer matches GeoNames country ISO code and state name against existing
Country and Location State records, then resolves each ADM2 parent code to that
state's existing document ID. It inserts Location District records with `state`
and `district_name` through Frappe's document API and validation. Existing records
are preserved, repeated state/name pairs are skipped, and unmapped source parents
and states without source districts are recorded in the JSON report. New states
are never created. A real run commits only after all rows succeed; failures roll
back the run.

Reusable helper: `assetsiq.setup.import_districts.import_location_districts`.
Preview with `dry_run=True`; insert with `dry_run=False` using Bench's Python
keyword-argument syntax:

```sh
bench --site test.local execute assetsiq.setup.import_districts.import_location_districts --kwargs '{"state_source":"/tmp/assetsiq-admin1.txt","district_source":"/tmp/assetsiq-admin2.txt","report_path":"/tmp/assetsiq-district-preview.json","dry_run":True}'
```

Use the same command with `dry_run=False` and a different report path to import.
Download the two files from the source above before running. Keep the report,
which includes source hashes and created record IDs, for audit purposes.

To add another district manually, open Location District, click Add Location
District, choose its State, enter District Name, and Save.

## Styling files

- `assetsiq/assetsiq/doctype/location_district/location_district.js`: full-form introduction.
- `assetsiq/assetsiq/doctype/location_district/location_district_list.js`: list introduction and name display.
- `assetsiq/public/css/location_district.css`: scoped full-form stylesheet.
- `assetsiq/public/css/location_state_list.css`: shared Soft Rows list styles.
- `assetsiq/public/assetsiq_harbor.bundle.scss`: includes the new stylesheet.

Build CSS with `bench build --app assetsiq` and reload the browser.
