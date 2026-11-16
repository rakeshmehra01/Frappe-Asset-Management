// Run: node apps/assetsiq/assetsiq/tests/asset_category_form.cjs
// Check saved/new identity visibility and scoped native sidebar behavior.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
let handlers;
let mobile = false;
const chain = { addClass() { return this; }, remove() { return this; } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname,
	"../assetsiq/doctype/asset_category/asset_category.js"), "utf8"), {
	frappe: {
		ui: {form: {on: (name, config) => { handlers = config; }}},
		utils: {is_xs: () => mobile, is_sm: () => false},
	},
	$: () => chain,
	__: text => text,
});
function check(isNew) {
	const calls = {sections: 0, hides: 0, overlays: 0, intros: 0, guides: 0};
	const doc = {category_name: isNew ? "" : "Router", name: isNew ? "new-category" : "Router"};
	const original = {...doc};
	const frm = {
		doc, fields_dict: {}, is_new: () => isNew,
		page: {wrapper: {}, sidebar: {
			hide: () => { calls.hides++; },
			css: (key, value) => { assert.equal(key, "display"); assert.equal(value, ""); calls.overlays++; },
		}},
		toggle_display: (field, visible) => { assert.equal(field, "category_name"); calls.visible = visible; },
		set_df_property: (field, property, value) => {
			assert.equal(field, "category_name"); assert.equal(property, "read_only"); calls.readOnly = value;
		},
		layout: {refresh_sections: () => { calls.sections++; }},
		dashboard: {parent: {find: () => ({remove: () => { calls.intros = 0; }})},
			add_section: () => { calls.intros++; }, show() {}},
		body: {addClass() {}, children: () => ({remove: () => { calls.guides = 0; }}),
			append: () => { calls.guides++; }},
	};
	for (let i = 0; i < 2; i++) handlers.refresh(frm);
	assert.equal(calls.visible, true);
	assert.equal(calls.readOnly, isNew ? 0 : 1);
	assert.equal(calls.sections, 2);
	assert.equal(calls.hides, mobile ? 0 : 2);
	assert.equal(calls.overlays, mobile ? 2 : 0);
	assert.equal(calls.intros, 1);
	assert.equal(calls.guides, 1);
	assert.deepEqual(doc, original);
}
check(false);
check(true);
mobile = true;
check(false);
check(true);
console.log("Passed: saved/new identity visibility, desktop tools collapsed, mobile overlay preserved, no duplicate panels or record changes.");
