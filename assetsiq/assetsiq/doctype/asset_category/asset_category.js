// Copyright (c) 2026, Rakesh Mehra and contributors
// For license information, please see license.txt

frappe.ui.form.on("Asset Category", {
	refresh(frm) {
		$(frm.page.wrapper).addClass("aiq-harbor-form aiq-executive aiq-category-form");

		// Frappe hides an autoname field after saving. Keep the category identity
		// visible here, but use the native Rename action for deliberate ID changes.
		frm.toggle_display("category_name", true);
		frm.set_df_property("category_name", "read_only", frm.is_new() ? 0 : 1);
		frm.layout.refresh_sections();

		// Hide only this form's native record-tools panel by default. The native
		// menu → Toggle Sidebar action can still reveal attachments, shares, etc.
		if (frappe.utils.is_xs() || frappe.utils.is_sm()) {
			// Mobile uses Frappe's overlay; leave its parent available to that menu.
			frm.page.sidebar.css("display", "");
		} else {
			frm.page.sidebar.hide();
		}
		// Static SVG paths keep icons sharp without loading an external library.
		const icons = {
			category: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
			name: '<path d="M20 13 13 20a2 2 0 0 1-3 0l-7-7V4h9l8 8a1 1 0 0 1 0 1Z"/><circle cx="7.5" cy="8" r="1"/>',
			unique: '<path d="m5 12 4 4L19 6"/><path d="M19 12v7H5V5h9"/>',
			serial: '<path d="M8 3H4v4m12-4h4v4M4 17v4h4m12-4v4h-4M8 8v8m4-8v8m4-8v8"/>',
			computer: '<rect x="4" y="3" width="16" height="13" rx="2"/><path d="M2 21h20m-13-5-1 5m7-5 1 5"/>',
			guide: '<path d="M9 18h6m-5 3h4M8.5 14a6 6 0 1 1 7 0c-1 .8-1 1.4-1 2h-5c0-.6 0-1.2-1-2Z"/>',
			info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
		};
		const icon = name => `<svg class="aiq-line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

		// Frappe sets an inline 150px height for Small Text. Start smaller once,
		// then leave the employee's manual resizing alone on later refreshes.
		const description_input = frm.fields_dict.description?.$input;
		if (description_input && !description_input.data("aiq-compact-height")) {
			description_input.css("height", "96px").data("aiq-compact-height", true);
		}

		// Use Frappe's dashboard extension without moving native form controls.
		// Form refreshes may run more than once; keep exactly one introduction.
		frm.dashboard.parent.find(".aiq-category-intro").remove();
		frm.dashboard.add_section(
			`<section class="aiq-executive-banner" aria-label="${__("About asset categories")}">
				<div class="aiq-banner-symbol">${icon("category")}</div>
				<div class="aiq-executive-banner__main">
					<div class="aiq-banner-overline"><span class="aiq-banner-brand">AssetsIQ</span><span class="aiq-banner-divider" aria-hidden="true"></span><span class="aiq-executive-eyebrow">${__("Inventory setup")}</span></div>
					<h2>${__("Organize with clarity.")}</h2>
					<p>${__("Create clear equipment categories and define the details your team needs to register each asset.")}</p>
					<div class="aiq-banner-caption"><span>${icon("category")}${__("Equipment categories")}</span><span>${icon("serial")}${__("Registration rules")}</span></div>
				</div>
			</section>`,
			null,
			"custom aiq-category-intro"
		);
		frm.dashboard.show();

		// Add a separate guidance column beside the existing native layout.
		// No fields are moved; repeated refreshes replace only our static guide.
		frm.body.addClass("aiq-guided-layout");
		frm.body.children(".aiq-user-guide").remove();
		frm.body.append(`
			<aside class="aiq-user-guide" aria-labelledby="aiq-category-guide-title">
				<section class="aiq-guide-card">
					<div class="aiq-guide-heading"><span class="aiq-guide-heading-icon">${icon("guide")}</span><div><span class="aiq-guide-eyebrow">${__("User guidance")}</span><h2 id="aiq-category-guide-title">${__("Category essentials")}</h2></div></div>
					<p class="aiq-guide-intro">${__("Group equipment by type, rather than by individual device.")}</p>
					<div class="aiq-guide-example">
						<div><span class="aiq-guide-eyebrow">${__("Example")}</span><strong>${icon("computer")}${__("Laptop")}</strong></div>
						<p>${__("Each laptop is registered separately as an asset.")}</p>
					</div>
					<h3>${__("Before you save")}</h3>
					<ol class="aiq-guidance-steps" role="list">
						<li><span class="aiq-step-icon">${icon("name")}</span><div><strong>${__("Choose one clear name")}</strong><p>${__("Use Laptop, Monitor, or Printer. Avoid duplicate categories.")}</p></div></li>
						<li><span class="aiq-step-icon">${icon("serial")}</span><div><strong>${__("Serial number rule")}</strong><p>${__("Require the manufacturer's serial number when needed.")}</p></div></li>
						<li><span class="aiq-step-icon">${icon("computer")}</span><div><strong>${__("Computer specifications")}</strong><p>${__("Require processor, memory, and storage details for computers.")}</p></div></li>
					</ol>
					<div class="aiq-guide-note">${icon("info")}<p>${__("Requirement checks will apply when asset registration is implemented.")}</p></div>
				</section>
			</aside>
		`);
	},
});
