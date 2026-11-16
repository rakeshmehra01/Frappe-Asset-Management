// Copyright (c) 2026, Rakesh Mehra and contributors
// For license information, please see license.txt

(() => {
	const doctype = "Asset Category";
	const escape = value => frappe.utils.escape_html(String(value ?? ""));
	const required = value => Number(value) === 1
		? `<span class="aiq-rule-badge"><span aria-hidden="true">✓</span> ${escape(__("Required"))}</span>`
		: `<span class="aiq-rule-optional">${escape(__("Not required"))}</span>`;

	// Add one introduction above native filters without replacing list controls.
	function add_introduction(listview) {
		if (listview.page.main.children(".aiq-category-list-intro").length) return;
		listview.page.page_form.before(`
			<section class="aiq-category-list-intro" aria-labelledby="aiq-category-list-title">
				<span>${escape(__("Inventory setup"))}</span>
				<h2 id="aiq-category-list-title">${escape(__("Asset Category"))}</h2>
				<p>${escape(__("Organize equipment types and define the details required during asset registration."))}</p>
			</section>
		`);
	}

	function refine_filters(listview) {
		const fields = listview.page.fields_dict;
		// Shorten labels only in this list toolbar, not in saved DocType fields.
		fields.serial_required?.set_label(__("Serial required"));
		fields.computer_specifications_required?.set_label(__("Computer details"));
		const search = fields.category_name;
		if (search) {
			search.$wrapper.addClass("aiq-category-search");
			search.$input?.attr({
				placeholder: __("Search categories…"),
				"aria-label": __("Search by category name"),
			});
		}
	}

	function decorate_subjects(listview) {
		const descriptions = new Map(listview.data.map(doc => [doc.name, doc.description || ""]));
		listview.$result.find(".list-subject a[data-name]").each((index, element) => {
			const description = descriptions.get(element.dataset.name) || "";
			// Supplement the native link without replacing it or its handlers.
			// Attribute values are assigned through the DOM, never interpolated HTML.
			$(element).addClass("aiq-precision-subject").attr(
				"data-aiq-description", description.replace(/\s+/g, " ").trim().slice(0, 180)
			);
		});
	}

	frappe.listview_settings[doctype] = {
		add_fields: ["category_name", "description", "serial_required", "computer_specifications_required"],
		hide_name_column: true,
		// Category Name is also the ID, so one name-search control is sufficient.
		hide_name_filter: true,
		formatters: {
			serial_required: required,
			computer_specifications_required: required,
		},
		onload(listview) {
			$(listview.page.wrapper).addClass("aiq-harbor-list aiq-executive aiq-precision-list aiq-category-list aqi-executive-list");
			add_introduction(listview);
			refine_filters(listview);
		},
		refresh(listview) {
			add_introduction(listview);
			refine_filters(listview);
			decorate_subjects(listview);
		},
	};
})();
