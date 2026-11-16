const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.ASSET_LIST_TEST_SOURCE || path.join(__dirname, '../assetsiq/doctype/asset/asset_list.js'), 'utf8');
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const headValues = new Map();
const collection = selector => ({
    length:1, text(value){if(value!==undefined)headValues.set(selector,value);return this;},
    toggle(){return this;},each(){return this;},prop(){return this;},attr(){return this;},toggleClass(){return this;},
});
const head = {length:1, find:collection};
const frappe = {session:{user:'employee@example.test'}, user_roles:['AssetsIQ Employee'],
    utils:{escape_html:escape},listview_settings:{},set_route:(...route)=>{frappe.lastRoute=route;}};
vm.runInNewContext(source,{frappe,__:value=>value,$:()=>collection(''),document:{createElement:()=>({textContent:'',className:''})}});
const api=frappe.assetsiq_asset_list;
const clone=value=>JSON.parse(JSON.stringify(value));
const filters=[['Asset','assigned_to','=','employee@example.test'],['Asset','asset_category','=','Laptop'],['Asset','asset_name','like','%Dell%'],['Asset','asset_status','=','Assigned']];
assert.deepEqual(clone(api.base_filters(filters)),filters.slice(0,3));
assert.equal(filters.length,4);
assert.equal(api.selected_tab(filters),null); // Assigned is an advanced filter, not one of the presets.
assert.equal(api.selected_tab([]),'all');
assert.equal(api.selected_tab([['asset_status','=','Available']]),'available');
assert.equal(api.selected_tab([['Asset','asset_status','=','Assignment Requested']]),'requests');
assert.equal(api.selected_tab([['Asset','asset_status','in',['Under Maintenance','Maintenance Requested']]]),'maintenance');
assert.equal(api.own_scope([]),true);
frappe.user_roles=['AssetsIQ IT'];
assert.equal(api.own_scope([]),false);
assert.equal(api.own_scope(filters),true);
frappe.user_roles=['AssetsIQ Employee'];
assert.deepEqual(clone(api.count_tabs([
    {asset_status:'Available',count:3},{asset_status:'Assigned',count:5},
    {asset_status:'Assignment Requested',count:'2'},{asset_status:'Maintenance Requested',count:1},
    {asset_status:'Under Maintenance',count:4},{asset_status:'Retired',count:2},
])),{all:17,available:3,requests:2,maintenance:5});
assert.ok(api.recipient(null,{},{}).includes('Unassigned'));
assert.ok(!api.recipient('<img src=x>',{},{}).includes('<img'));
assert.ok(api.recipient('user@example.test',{}, {assigned_to_full_name:'Full Name'}).includes('Full Name'));
const settings=frappe.listview_settings.Asset;
assert.equal(settings.hide_name_column,true);
assert.equal(settings.button.get_label({asset_status:'Assignment Requested'}),'Review request');
settings.button.action({name:'AST-00002'});
assert.deepEqual(frappe.lastRoute,['Form','Asset','AST-00002']);
// Decorating a native subject preserves it and uses textContent for secondary data.
const row={dataset:{}};
const link={dataset:{name:'AST-00002'},classList:{add(){}},child:null,
    querySelector(){return this.child;},appendChild(child){this.child=child;},closest:()=>row};
const list={data:[{name:'AST-00002',asset_category:'<img src=x>',asset_status:'Assignment Requested'}],
    $result:{find:()=>({each:callback=>callback(0,link)})}};
api.decorate_rows(list);api.decorate_rows(list);
assert.equal(link.child.textContent,'AST-00002 · <img src=x>');
assert.equal(row.dataset.aiqAssetTone,'requested');
(async()=>{
    let current=clone(filters), refreshes=0;
    const view={start:20,page:{main:{find:()=>head}},
        filter_area:{get:()=>clone(current),clear:async refresh=>{assert.equal(refresh,false);current=[];},set:async value=>{current=clone(value);}},
        refresh:async()=>{refreshes++;}};
    await api.apply_tab(view,'requests');
    assert.deepEqual(current,filters.slice(0,3).concat([['Asset','asset_status','=','Assignment Requested']]));
    assert.equal(view.start,0);assert.equal(refreshes,1);
    await api.apply_tab(view,'maintenance');
    assert.deepEqual(current.slice(0,3),filters.slice(0,3));
    assert.deepEqual(current[3],['Asset','asset_status','in',['Maintenance Requested','Under Maintenance']]);
    await api.apply_tab(view,'all');
    assert.deepEqual(current,filters.slice(0,3));
    assert.equal(view._aiq_filter_busy,false);
    const countRequests=[];
    frappe.xcall=(method,args)=>{
        assert.equal(method,'frappe.client.get_list');
        assert.deepEqual(clone(args.filters),filters.slice(0,3));
        return new Promise(resolve=>countRequests.push(resolve));
    };
    const first=api.update_counts(view), second=api.update_counts(view);
    countRequests[1]([{asset_status:'Assigned',count:7}]);await second;
    const allSelector='[data-aiq-asset-filter="all"] .aiq-filter-count';
    assert.equal(headValues.get(allSelector),7);
    countRequests[0]([{asset_status:'Assigned',count:99}]);await first;
    assert.equal(headValues.get(allSelector),7); // An older response cannot replace newer counts.
    console.log('Asset Soft Rows checks passed: preserved recipient/search filters, native navigation, safe row text, status counts and stale-response protection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
