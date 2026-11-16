// AssetsIQ Location District: preserve native filtering, sorting and actions.
(() => {
    const escape = value => frappe.utils.escape_html(String(value ?? ""));
    function refine(listview) {
        if (!listview.page.main.find(".aiq-district-list-intro").length) {
            listview.page.page_form.before(`
                <section class="aqi-state-list-intro aiq-district-list-intro">
                    <span>${escape(__("Location setup"))}</span>
                    <h2>${escape(__("Location District"))}</h2>
                    <p>${escape(__("Find district names and the states they belong to."))}</p>
                </section>`);
        }
        const search = listview.page.fields_dict.district_name;
        search?.$input?.attr({placeholder: __("Search district names…"), "aria-label": __("Search by district name")});
    }
    frappe.listview_settings["Location District"] = {
        hide_name_column: true,
        hide_name_filter: true,
        add_fields: ["district_name", "state"],
        onload(listview) {
            $(listview.page.wrapper).addClass("aqi-state-soft-list aqi-executive-list aiq-district-list");
            refine(listview);
        },
        refresh: refine,
    };
})();
