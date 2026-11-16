// AssetsIQ Location District full-form presentation.
frappe.ui.form.on("Location District", {
    refresh(frm) {
        $(frm.wrapper).addClass("aiq-location-district");
        if (!frm.dashboard.parent.find(".aiq-district-intro").length) {
            const escape = value => frappe.utils.escape_html(__(value));
            frm.dashboard.add_section(`
                <section class="aiq-district-banner">
                    <span>${escape("AssetsIQ / Location setup")}</span>
                    <h2>${escape("Connect every district to its state.")}</h2>
                    <p>${escape("Choose the state and enter the recognized district name. Each district name must be unique within its state.")}</p>
                </section>`, null, "custom aiq-district-intro");
        }
        frm.dashboard.show();
    },
});
