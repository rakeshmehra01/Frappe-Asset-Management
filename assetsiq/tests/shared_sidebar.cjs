// Verify route scoping against the real shared navigation script.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
let route, active;
let onChange;
const routes = {
    doctypes: ["Asset Category", "Asset Location", "Location State", "Location District", "Future Asset"],
    workspaces: ["AssetsIQ — IT Operations", "My Workspace"],
    reports: ["Asset Availability"],
    pages: ["assetsiq-overview"],
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/js/harbor_desk.js"), "utf8"), {
    frappe: {
        boot: {assetsiq_routes: routes}, get_route: () => route,
        router: {on: (_, handler) => {onChange = handler;}, slug: s => s.toLowerCase().replaceAll(" ", "-")},
        after_ajax: () => {},
    },
    document: {body: {classList: {toggle: (_, enabled) => {active = enabled;}}}, querySelector: () => null},
    $: () => ({on: () => {}}),
    requestAnimationFrame: fn => fn(),
});
const cases = [
    [["Form", "Location State", "record"], true],
    [["List", "Location District", "List"], true],
    [["Form", "Asset Location", "new-asset-location"], true],
    [["List", "Asset Category", "List"], true],
    [["Tree", "Future Asset"], true],
    [["Workspaces", "my-workspace"], true],
    [["Workspaces", "assetsiq-—-it-operations"], true],
    [["query-report", "Asset Availability"], true],
    [["assetsiq-overview"], true],
    [["Form", "User", "Administrator"], false],
    [["List", "Country"], false],
    [["query-report", "Unrelated Report"], false],
    [["Workspaces", "Build"], false],
    [["unrelated-page"], false],
];
for (const [next, expected] of cases) {
    route = next;
    onChange();
    assert.equal(active, expected, next.join("/"));
}
// Simulate a new app DocType appearing in boot data without editing the JS.
routes.doctypes.push("New Hardware");
route = ["Form", "New Hardware", "new"];
onChange();
assert.equal(active, true);
console.log(`Passed ${cases.length + 1} shared-sidebar scope checks.`);
