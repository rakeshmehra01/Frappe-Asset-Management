// Copyright (c) 2026, Rakesh Mehra and contributors
// For license information, please see license.txt

function update_location_geography_controls(frm) {
	// Leave saved values intact on refresh; enable children only after their parent.
	frm.toggle_enable("state", Boolean(frm.doc.country));
	frm.toggle_enable("district", Boolean(frm.doc.country && frm.doc.state));
}

// Add the Executive design without replacing native fields or their event handlers.
function render_asset_location_design(frm) {
	const escape = value => frappe.utils.escape_html(String(value ?? ""));
	$(frm.page.wrapper).addClass("aiq-location-form aiq-executive");
	$(frm.wrapper).addClass("aiq-location-fields");
	frm.body.addClass("aiq-location-guided-layout");

	// The legacy Select is not the document's real ID; keep it hidden, not deleted.
	frm.toggle_display("naming_series", false);
	const identity = frm.is_new() ? __("Assigned automatically after saving") : frm.doc.name;
	frm.dashboard.parent.find(".aiq-location-intro").remove();
	frm.dashboard.add_section(
		`<section class="aiq-location-banner">
			<span class="aiq-location-banner__icon" aria-hidden="true"></span>
			<div>
				<span class="aiq-location-eyebrow">${escape(__("AssetsIQ / Location setup"))}</span>
				<h2>${escape(__("A clear home for every asset."))}</h2>
				<p>${escape(__("Define the geography, address and context your team needs to find equipment."))}</p>
				<span class="aiq-location-identity">${escape(__("Location ID"))}: ${escape(identity)}</span>
			</div>
		</section>`,
		null,
		"custom aiq-location-intro"
	);
	frm.dashboard.show();

	// Set a compact initial textarea height once, then preserve manual resizing.
	for (const fieldname of ["address", "description"]) {
		const input = frm.fields_dict[fieldname]?.$input;
		if (input && !input.data("aiq-location-compact")) {
			input.css("height", "92px").data("aiq-location-compact", true);
		}
	}

	// Static decorative icons need no external icon library or network request.
	const paths = {
		guide: '<path d="M9 18h6m-5 3h4M8.5 14a6 6 0 1 1 7 0c-1 .8-1 1.4-1 2h-5c0-.6 0-1.2-1-2Z"/>',
		geography: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/>',
		address: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
		notes: '<path d="M6 3h9l4 4v14H5V3Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/>',
	};
	const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
	frm.body.children(".aiq-location-guide").remove();
	frm.body.append(`
		<aside class="aiq-location-guide" aria-labelledby="aiq-location-guide-title">
			<div class="aiq-location-guide__heading">
				<span class="aiq-location-guide__symbol">${icon("guide")}</span>
				<div><span class="aiq-location-eyebrow">${escape(__("Guided setup"))}</span>
				<h2 id="aiq-location-guide-title">${escape(__("Make it easy to find."))}</h2></div>
			</div>
			<ol role="list">
				<li><span class="aiq-location-guide__step-icon">${icon("geography")}</span><div>
					<strong>${escape(__("Start with the country"))}</strong>
					<p>${escape(__("Then choose a matching state and district when available."))}</p>
				</div></li>
				<li><span class="aiq-location-guide__step-icon">${icon("address")}</span><div>
					<strong>${escape(__("Be specific about the address"))}</strong>
					<p>${escape(__("Include the building, floor, room or storage area."))}</p>
				</div></li>
				<li><span class="aiq-location-guide__step-icon">${icon("notes")}</span><div>
					<strong>${escape(__("Add useful context"))}</strong>
					<p>${escape(__("Use Description for details that help the IT team identify this location."))}</p>
				</div></li>
			</ol>
			<p class="aiq-location-guide__note">${escape(__("Changing Country clears State and District. Changing State clears District."))}</p>
		</aside>
	`);
}

frappe.ui.form.on("Asset Location", {
	setup(frm) {
		// Read the CURRENT parent whenever the user opens a searchable Link dropdown.
		frm.set_query("state", () => ({ filters: { country: frm.doc.country || "" } }));
		frm.set_query("district", () => ({ filters: { state: frm.doc.state || "" } }));
	},
	refresh(frm) {
		update_location_geography_controls(frm);
		render_asset_location_design(frm);
	},
	async country(frm) {
		// A different country invalidates both dependent selections.
		await frm.set_value({ state: null, district: null });
		update_location_geography_controls(frm);
	},
	async state(frm) {
		// A different state invalidates the selected district.
		await frm.set_value("district", null);
		update_location_geography_controls(frm);
	},
});
