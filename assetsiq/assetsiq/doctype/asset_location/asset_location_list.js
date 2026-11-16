// Copyright (c) 2026, Rakesh Mehra and contributors
// For license information, please see license.txt

(() => {
	const escape = value => frappe.utils.escape_html(String(value ?? ""));

	// Keep native page controls and queries; customize only their presentation.
	function refine_location_list(listview) {
		const fields = listview.page.fields_dict;
		fields.location_name?.$input?.attr({placeholder: __("Search location names…"), "aria-label": __("Search by location name")});
		for (const [name, label] of [["country", "Country"], ["state", "State"], ["district", "District"]]) {
			fields[name]?.$input?.attr({placeholder: __(label), "aria-label": __("Filter by {0}", [__(label)])});
		}
		// Preserve the native header's sorting attributes and event handlers.
		listview.$result.find('.list-row-head [data-sort-by="name"]').text(__("Location ID"));
	}

	function add_location_introduction(listview) {
		if (listview.page.main.children(".aiq-location-list-intro").length) return;
		listview.page.page_form.before(`
			<section class="aiq-location-list-intro" aria-labelledby="aiq-location-list-title">
				<span class="aiq-location-eyebrow">${escape(__("Location setup"))}</span>
				<h2 id="aiq-location-list-title">${escape(__("Asset Location"))}</h2>
				<p>${escape(__("Find the offices, rooms and storage areas used to locate your equipment."))}</p>
			</section>
		`);
	}

	// Use plain DOM attributes so user-entered notes never become executable HTML.
	function decorate_location_subjects(listview) {
		const addresses = new Map(listview.data.map(doc => [String(doc.name), doc.address || doc.description || ""]));
		listview.$result.find(".list-subject a[data-name]").each((_, element) => {
			const summary = (addresses.get(element.dataset.name) || "").replace(/\s+/g, " ").trim();
			$(element).attr("data-aiq-location-summary", summary.slice(0, 120));
		});
	}

	frappe.listview_settings["Asset Location"] = {
		add_fields: ["address", "description"],
		hide_name_column: true,
		hide_name_filter: true,
		onload(listview) {
			$(listview.page.wrapper).addClass("aiq-location-list aqi-executive-list");
			add_location_introduction(listview);
			refine_location_list(listview);
		},
		refresh(listview) {
			add_location_introduction(listview);
			refine_location_list(listview);
			decorate_location_subjects(listview);
		},
	};
})();
