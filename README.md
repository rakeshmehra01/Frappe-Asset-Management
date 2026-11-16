### AssetsIQ

Hardware and software asset lifecycle management

### Interface and role-specific Workspaces

AssetsIQ is being built inside Frappe Desk with two standard Workspaces:

- **AssetsIQ — My Workspace**, restricted to AssetsIQ Employee.
- **AssetsIQ — IT Operations**, restricted to AssetsIQ IT.

The former shared AssetsIQ entry was renamed into IT Operations using Frappe's
supported document rename operation. There is no third shared landing Workspace.
Users with both roles can access both Workspaces; Administrator can inspect both.

This supersedes the earlier standalone Harbor-page
experiment. The existing `www/assetsiq` files are retained for reference; they are
not linked from the Desk Workspace. Harbor styling will be adapted to supported
Desk components without modifying Frappe core.

Each Workspace has its own Workspace Sidebar with a Home link and a Desktop Icon.
All definitions are exported into this app. The
two operational roles are exported through the filtered Role fixture.

To initialise the entry point on a site that already has the two AssetsIQ roles:

```bash
bench --site test.local execute assetsiq.setup.desk.setup_role_workspaces
```

The setup function preserves later app-owned Workspace content on subsequent runs
and enforces the approved role restriction on each Workspace and icon. The old
`setup_workspace` command remains an alias to this function and cannot recreate
the shared landing entry. Desk Access is enabled for both operational roles.

Only headers and introductions are installed at this stage. Counts, lists and
business shortcuts wait for their DocTypes and server-side record permissions.
Native Desk also checks module access; full ordinary-user navigation is verified
alongside the first DocType permissions.

### Learning progress

The learner created the standard `Asset Category` DocType in the AssetsIQ module.
Harbor Executive is selected for the app. Its form/list styles live in
`assetsiq/public/css/harbor_desk.css`, compiled through
`assetsiq/public/assetsiq_harbor.bundle.scss` and loaded as the content-hashed
`assetsiq_harbor.bundle.css` through `app_include_css`. After CSS changes, run
`bench build --app assetsiq` and clear the site cache.
The DocType's standard form/list scripts attach scoped styling classes. The
form adds a static introduction using Frappe's dashboard extension; no fields,
permissions or saved records are changed by the design scripts. A versioned JavaScript bundle adds a vector logo and short visible Workspace
labels on Asset Category and the two app Workspaces. Original routes and labels
are preserved outside those screens. The shared Desk sidebar is themed only
while those app screens are active. Native navigation,
save behavior and access checks remain in use. Other app screens will receive
the design incrementally after review.

### Precision category list

The Asset Category list uses native columns, filters, sorting and pagination,
with two requirement badges, description previews and a compact horizontal
filter toolbar. The custom category-count strip has been removed along with
its background requests. No sample records are seeded. Standard list settings live in
`assetsiq/assetsiq/doctype/asset_category/asset_category_list.js`.

### Location geography

Asset Location uses searchable Country → Location State → Location District
links. Standard form queries filter by parent and clear dependent selections;
server validation also protects imports and API writes. The two app-owned
reference masters have parent-scoped uniqueness and protected parent links.
No State/District data is seeded. Maintain or import geography records for the
countries you use. Setup is repeatable with
`bench --site test.local execute assetsiq.setup.geography.setup_location_geography`.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch version-16
bench install-app assetsiq
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/assetsiq
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade
### CI

This app can use GitHub Actions for CI. The following workflows are configured:

- CI: Installs this app and runs unit tests on every push to `develop` branch.
- Linters: Runs [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules) and [pip-audit](https://pypi.org/project/pip-audit/) on every pull request.


### License

mit
