# AssetsIQ Home and sidebar

Desktop has one **AssetsIQ Home** icon. It opens `/desk/assetsiq-home`.
IT staff see **IT Operations** and **My Workspace** cards. Employees see only
**My Workspace**. Cards are filtered by native Workspace access from boot data;
workspace roles are configured by `assetsiq.setup.home.setup_home`.

Inside a workspace, the sidebar shows Home, the selected workspace, and its
configured DocTypes. Home returns to the common landing page. Search,
notifications, collapse controls and the user menu remain native.

Edit `workspaces` at the top of `assetsiq/public/js/workspace_navigation.js`
to add future DocTypes. My Workspace has no asset link until that DocType is
built. User-owned asset access must be enforced by the future DocType's server
permissions; sidebar navigation does not filter or secure records.

Setup: `bench --site test.local execute assetsiq.setup.home.setup_home`.
This creates Home's Page, Sidebar and Desktop Icon, updates workspace roles,
and hides the two old desktop icons. It preserves existing workspace content
and business data. A before-change snapshot is at
`/tmp/assetsiq-before-common-home.json` on the initial setup site.
The existing role workspace setup helper also preserves these shared roles.

Build: `bench build --app assetsiq`, clear site cache, and hard refresh.
Checks (from app root): `node assetsiq/tests/workspace_navigation.cjs` and
`node assetsiq/tests/shared_sidebar.cjs`.
Installed role checks:
`bench --site test.local execute assetsiq.tests.verify_home.verify`.
