const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let readable = new Set(['Asset', 'Asset Category', 'Asset Location', 'Location State', 'Location District']);
const it = 'AssetsIQ — IT Operations', mine = 'AssetsIQ — My Workspace';
const frappe = {
    session: {user: 'employee@example.test'},
    boot: {workspaces: {pages: [{name: it}, {name: mine}]}, assetsiq_routes: {doctypes: ['Future Asset']}},
    router: {slug: name => name.toLowerCase().replaceAll(' ', '-'), on() {}},
    utils: {escape_html: value => String(value), icon: () => '<svg></svg>', generate_route: args => '/desk/' + args.name + (args.route_options ? '?' + new URLSearchParams(args.route_options).toString() : '')},
    model: {can_read: name => readable.has(name)},
    after_ajax() {},
};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../public/js/workspace_navigation.js'), 'utf8'), {
    frappe, __: value => value, document: {}, $: () => ({on() {}}),
});
const nav = frappe.assetsiq_navigation;
assert.equal(nav.resolve_view(['assetsiq-home']).home, true);
let cards = nav.home_markup();
assert.ok(cards.includes('<h2>IT Operations</h2>'));
assert.ok(cards.includes('<h2>My Workspace</h2>'));
assert.equal(nav.resolve_view(['Workspaces', it]).workspace.name, it);
assert.equal(nav.resolve_view(['Workspaces', frappe.router.slug(mine)]).workspace.name, mine);
for (const kind of ['List', 'Form', 'Tree']) {
    assert.equal(nav.resolve_view([kind, 'Asset Location', 'record']).workspace.name, it);
}
const locations = nav.visible_items(nav.workspaces[0]).find(item => item.label === 'Locations');
assert.equal(locations.children.length, 3);
for (const doctype of ['Location State', 'Location District']) {
    assert.equal(nav.resolve_view(['Form', doctype, 'record']).workspace.name, it);
}
let groupHtml = nav.render_items([locations], ['List', 'Location State'], it);
assert.ok(groupHtml.includes('<details'));
assert.ok(groupHtml.includes(' open>'));
assert.ok(groupHtml.includes('aria-current="page"'));
assert.ok(groupHtml.includes('aiq-navigation-children'));
readable.delete('Location District');
assert.equal(nav.visible_items(nav.workspaces[0]).find(item => item.label === 'Locations').children.length, 2);
readable.delete('Location State');
readable.delete('Asset Location');
assert.equal(nav.visible_items(nav.workspaces[0]).some(item => item.label === 'Locations'), false); // No empty group.
readable.add('Location District');
readable.add('Location State');
readable.add('Asset Location');
assert.equal(nav.resolve_view(['List', 'User']).active, false);
assert.equal(nav.resolve_view(['Workspaces', 'Build']).active, false);
assert.equal(nav.resolve_view(['List', 'Future Asset']).active, true);
assert.equal(nav.visible_items(nav.workspaces[1]).length, 1);
// Future employee screens become routable by updating the mapping alone.
nav.workspaces[1].items.push({doctype: 'Future Asset'});
readable.add('Future Asset');
assert.equal(nav.resolve_view(['Form', 'Future Asset', 'asset-1']).workspace.name, mine);
// A workspace hidden by native permissions never appears in our selector.
frappe.boot.workspaces.pages = [{name: mine}];
assert.equal(nav.available_workspaces().length, 1);
cards = nav.home_markup();
assert.ok(!cards.includes('IT Operations'));
assert.ok(cards.includes('<h2>My Workspace</h2>'));
assert.equal(nav.resolve_view(['List', 'Asset Location']).active, false);
readable.delete('Future Asset');
assert.equal(nav.visible_items(nav.workspaces[1]).length, 1);
assert.equal(nav.resolve_view(['List', 'Asset']).workspace.name, mine);
const myHtml = nav.render_items(nav.visible_items(nav.workspaces[1]), ['List', 'Asset'], mine);
assert.ok(myHtml.includes('My Assets'));
assert.ok(myHtml.includes('assigned_to=employee%40example.test'));
frappe.boot.workspaces.pages = [{name: it}, {name: mine}];
nav.resolve_view(['Workspaces', it]);
assert.equal(nav.resolve_view(['List', 'Asset']).workspace.name, it);
nav.resolve_view(['Workspaces', mine]);
assert.equal(nav.resolve_view(['Form', 'Asset', 'AST-00001']).workspace.name, mine);
console.log('Passed workspace routing, permission filtering and future-screen checks.');

readable.add('Asset Maintenance');
nav.resolve_view(['Workspaces', mine]);
assert.equal(nav.resolve_view(['Form', 'Asset Maintenance', 'AMT-00001']).workspace.name, mine);
const maintenance = nav.visible_items(nav.workspaces[1]).find(item => item.doctype === 'Asset Maintenance');
assert.ok(maintenance);
assert.ok(nav.render_items([maintenance], ['List', 'Asset Maintenance'], mine).includes('requested_by=employee%40example.test'));
nav.resolve_view(['Workspaces', it]);
assert.equal(nav.resolve_view(['List', 'Asset Maintenance']).workspace.name, it);
console.log('Passed Maintenance navigation and personal requester filtering.');
