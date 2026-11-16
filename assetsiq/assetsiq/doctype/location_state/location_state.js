// Copyright (c) 2026, Rakesh Mehra and contributors
// For license information, please see license.txt

frappe.ui.form.on("Location State", {
    // Reapply the design when Frappe displays or refreshes this full form.
    refresh(frm) {
        // Keep the full form separate from our Quick Entry popup styles.
        $(frm.wrapper).addClass("aqi-location-state");

        // Start Small Text at a compact height once; preserve later manual resizing.
        const description = frm.fields_dict.description?.$input;
        if (description && !description.data("aqi-compact-height")) {
            description.css("height", "88px").data("aqi-compact-height", true);
        }

        // Static vector icons stay sharp without an external icon library.
        const paths = {
            guide: '<path d="M9 18h6m-5 3h4M8.5 14a6 6 0 1 1 7 0c-1 .8-1 1.4-1 2h-5c0-.6 0-1.2-1-2Z"/>',
            country: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/>',
            name: '<path d="m20 13-7 7a2 2 0 0 1-3 0l-7-7V4h9l8 8a1 1 0 0 1 0 1Z"/><circle cx="7.5" cy="8" r="1"/>',
            check: '<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>',
        };
        // Decorative icons: the adjacent text provides their accessible meaning.
        const icon = name => `<svg class="aqi-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

        // Replace only our introduction so refresh does not duplicate it.
        frm.dashboard.parent.find(".aqi-state-intro").remove();
        frm.dashboard.add_section(
            `<section class="aqi-state-banner">
                <span class="aqi-state-banner__label">${__("AssetsIQ / Location setup")}</span>
                <h2>${__("A place for every state.")}</h2>
                <p>${__("Connect a state, province or region to its country.")}</p>
            </section>`,
            null,
            "custom aqi-state-intro"
        );
        frm.dashboard.show();

        // Match this class exactly in CSS to apply the column and row gaps.
        frm.body.addClass("aqi-state-guided-layout");
        // Leave native fields in place and replace only our previous guide.
        frm.body.children(".aqi-state-guide").remove();
        frm.body.append(`
            <aside class="aqi-state-guide" aria-labelledby="aqi-state-guide-title">
                <div class="aqi-state-guide__header">
                    <span class="aqi-state-guide__symbol">${icon("guide")}</span>
                    <div>
                        <span class="aqi-state-guide__label">${__("Guided setup")}</span>
                        <h2 id="aqi-state-guide-title">${__("Keep locations consistent.")}</h2>
                    </div>
                </div>
                <ol class="aqi-state-guide__steps" role="list">
                    <li>
                        <span class="aqi-state-guide__step-icon">${icon("country")}</span>
                        <div><strong>${__("Choose the country")}</strong><p>${__("Select the country this state or region belongs to.")}</p></div>
                    </li>
                    <li>
                        <span class="aqi-state-guide__step-icon">${icon("name")}</span>
                        <div><strong>${__("Use a recognized name")}</strong><p>${__("For example, Maharashtra or California.")}</p></div>
                    </li>
                    <li>
                        <span class="aqi-state-guide__step-icon">${icon("check")}</span>
                        <div><strong>${__("Avoid duplicate entries")}</strong><p>${__("Check the existing states for your selected country.")}</p></div>
                    </li>
                </ol>
            </aside>
        `);
    },
});
