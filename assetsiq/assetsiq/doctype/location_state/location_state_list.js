//apps → assetsiq → assetsiq → assetsiq → doctype → location_state -> Location_State_list.js
// AssetsIQ — Location State list customization.

// frappe.listview_settings["Location State"] configures this DocType’s list.
// onload(listview) runs when the list page is created.
// listview.page.wrapper refers to the page’s outer container.
// addClass() adds our styling label without replacing native controls.
frappe.listview_settings["Location State"] ={
    // Run when Frappe creates this list page.




    // Hide the generated ID column; State Name remains the main label.
      hide_name_column: true,

      // Remove the ID search box from the filter toolbar.
      hide_name_filter: true,
    
       // onload function continues below.

    onload(listview){
    // Add a class so our CSS targets only this list.
        $(listview.page.wrapper).addClass("aqi-state-soft-list aqi-executive-list");

    // Insert our introduction before Frappe's native filter toolbar.
    listview.page.page_form.before(`  
        <section class="aqi-state-list-intro">
         <span>${__("Location Setup")} </span>
         <h2>${__("Location State")} </h2>
         <p>${__("States, provinces and regions linked to their country.")}</p>
        </section>
    `);

// Find Frappe's existing State Name filter.
const search = listview.page.fields_dict.state_name;

//Update its hints when control is available.
if(search){
    search.$input.attr({placeholder:__("Search state name"), 
        "aria-label":
         __("Search by state name")});
}




    },
};
