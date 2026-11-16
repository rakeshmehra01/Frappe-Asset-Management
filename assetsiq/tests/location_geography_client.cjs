// Run with Node: node apps/assetsiq/assetsiq/tests/location_geography_client.cjs
// Exercise the real form handlers without connecting to a browser or database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
let handlers;
const queries = {};
const enabled = {};
const doc = {name: "LOCATION-TEST", country: "Country A", state: "State A", district: "District A"};
let intros = 0;
let guides = 0;
let height_updates = 0;
const display = {};
function textarea() {
	const values = new Map();
	return {$input: {
		data(key, value) { if (arguments.length === 1) return values.get(key); values.set(key, value); return this; },
		css(key, value) { assert.equal(key, "height"); assert.equal(value, "92px"); height_updates++; return this; },
	}};
}
const frm = {
	doc,
	page: {wrapper: {}},
	wrapper: {},
	body: {
		addClass() {},
		children(selector) { assert.equal(selector, ".aiq-location-guide"); return {remove() { guides = 0; }}; },
		append(html) { assert(html.includes('aria-labelledby="aiq-location-guide-title"')); assert(html.includes("</aside>")); guides++; },
	},
	dashboard: {
		parent: {find: () => ({remove() { intros = 0; }})},
		add_section(html) { assert(html.includes("LOCATION-TEST")); intros++; },
		show() {},
	},
	fields_dict: {address: textarea(), description: textarea()},
	is_new: () => false,
	toggle_display: (name, value) => { display[name] = value; },
	set_query: (name, query) => { queries[name] = query; },
	toggle_enable: (name, value) => { enabled[name] = value; },
	set_value: async (name, value) => {
		if (typeof name === "object") Object.assign(doc, name);
		else doc[name] = value;
	},
};
const source = path.join(__dirname, "../assetsiq/doctype/asset_location/asset_location.js");
vm.runInNewContext(fs.readFileSync(source, "utf8"), {
	frappe: {
		ui: {form: {on: (name, config) => { handlers = config; }}},
		utils: {escape_html: value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")},
	},
	__: value => value,
	$: () => ({addClass() {}}),
});
(async () => {
	handlers.setup(frm);
	handlers.refresh(frm);
	handlers.refresh(frm);
	assert.equal(intros, 1);
	assert.equal(guides, 1);
	assert.equal(height_updates, 2); // Only once for each textarea, not every refresh.
	assert.equal(display.naming_series, false);
	assert.equal(doc.state, "State A");
	assert.equal(doc.district, "District A");
	assert(enabled.state && enabled.district);
	assert.equal(queries.state().filters.country, "Country A");
	assert.equal(queries.district().filters.state, "State A");
	doc.country = "Country B";
	await handlers.country(frm);
	assert.equal(doc.state, null);
	assert.equal(doc.district, null);
	assert(enabled.state && !enabled.district);
	assert.equal(queries.state().filters.country, "Country B");
	doc.state = "State B";
	doc.district = "Old district";
	await handlers.state(frm);
	assert.equal(doc.district, null);
	assert(enabled.district);
	assert.equal(queries.district().filters.state, "State B");
	doc.country = null;
	await handlers.country(frm);
	assert(!enabled.state && !enabled.district);
	assert.equal(queries.state().filters.country, "");
	assert.equal(queries.district().filters.state, "");
	console.log("Passed: dependent queries, child clearing, parent gating, saved values, one banner/guide per refresh, and preserving textarea sizing.");
})().catch(error => { console.error(error); process.exitCode = 1; });
