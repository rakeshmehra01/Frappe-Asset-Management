frappe.pages["assetsiq-home"].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper, title: __("Home"), single_column: true,
    });
    page.main.addClass("aiq-home-page");
    $(wrapper).on("show", () => {
        page.main.html(frappe.assetsiq_navigation.home_markup());
    });
    page.main.html(frappe.assetsiq_navigation.home_markup());
};
