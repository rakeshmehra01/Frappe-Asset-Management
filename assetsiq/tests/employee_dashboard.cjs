const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.env.EMPLOYEE_DASHBOARD_SOURCE || path.join(__dirname, '../public/js/employee_dashboard.js'), 'utf8');
const copy = x => JSON.parse(JSON.stringify(x));
const settle = async () => {for (let i=0;i<8;i++) await new Promise(resolve=>setImmediate(resolve));};
class Element {
    constructor(){this.dataset={};this.events={};this.attrs={};this.value='';this.content='';this.hidden=false;this.disabled=false;}
    get innerHTML(){return this.content;} set innerHTML(value){this.content=value;}
    get textContent(){return this.content;} set textContent(value){this.content=value;}
    setAttribute(key,value){this.attrs[key]=value;}
    addEventListener(type,handler){(this.events[type]||=[]).push(handler);}
    fire(type,event){for(const handler of this.events[type]||[])handler(event);}
    focus(){this.focused=true;}
}
function harness(user='employee@example.test') {
    const app=new Element(),refresh=new Element(),search=new Element(),clear=new Element(),form=new Element();
    const regions=Object.fromEntries(['message','kpis','tabs','queue','pagination','mix','recent','updated'].map(key=>[key,new Element()]));
    const cards=['total','assigned','pending','requested','maintenance'].map(key=>{const e=new Element();e.dataset.kpi=key;e.textContent='—';return e;});
    const filterButtons=['all','pending','assigned','requested','maintenance'].map(key=>{const e=new Element();e.dataset={action:'filter',filter:key};return e;});
    regions.tabs.querySelectorAll=()=>filterButtons;
    app.querySelector=selector=> {
        const region=selector.match(/^\[data-region="([^"]+)"\]$/)?.[1];
        if(region)return regions[region];
        if(selector==='input[type="search"]')return search;
        if(selector==='[data-action="refresh"]')return refresh;
        if(selector==='[data-action="clear-search"]')return clear;
        if(selector==='.ops-search')return form;
        if(selector==='[data-kpi="total"]')return cards[0];
        throw Error('Unknown selector: '+selector);
    };
    app.querySelectorAll=()=>cards;
    const root={host:{isConnected:true},querySelector:()=>app};
    const seed=Array.from({length:7},(_,i)=>({name:'AST-'+i,asset_name:i===1?'Device <script>unsafe</script>':'Device '+i,assigned_to:user,
        asset_status:['Assigned','Assignment Requested','Maintenance Requested','Under Maintenance','Assigned','Assigned','Assigned'][i],
        asset_category:i%2?'Laptop':'Monitor',asset_location:'8',location_label:'Haldwani Office',modified:'2026-11-06 08:00:00',serial_number:'SN-'+i}));
    let records=[...seed,{...seed[0],name:'SECRET',asset_name:'Other user secret',assigned_to:'another@example.test'}];
    const calls=[],routes=[],handlers={};
    let route=['Workspaces','AssetsIQ — My Workspace'];
    const flags={failSummary:false,failQueue:false,late:null};
    const events={off(){return this;},on(name,handler){handlers[name]=handler;return this;}};
    const frappe={session:{user},utils:{escape_html:text=>String(text).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))},
        get_route:()=>route,router:{slug:text=>text.toLowerCase().replaceAll(' ','-')},datetime:{comment_when:()=>'<span>1 hour ago</span>'},
        set_route:(...args)=>routes.push({args,filters:copy(frappe.route_options||{})}),
        xcall:async(method,args)=>{
            assert.equal(method,'frappe.client.get_list');
            assert.equal(args.filters.assigned_to,user,'every query must explicitly restrict ownership, including staff');
            const status=args.filters.asset_status;
            assert.ok(typeof status==='string'||(status[0]==='in'&&status[1].every(s=>['Assigned','Assignment Requested','Maintenance Requested','Under Maintenance'].includes(s))));
            calls.push(copy(args));
            const isSummary=!!args.group_by||args.fields.includes('modified');
            if(isSummary&&flags.failSummary)throw Error('summary offline');
            if(!isSummary&&flags.failQueue)throw Error('queue offline');
            let filtered=records.filter(row=>row.assigned_to===args.filters.assigned_to&&(typeof status==='string'?row.asset_status===status:status[1].includes(row.asset_status)));
            if(args.or_filters?.length)filtered=filtered.filter(row=>args.or_filters.some(([field,operator,value])=>String(row[field]||'').includes(value.slice(1,-1))));
            if(args.group_by){const groups={};filtered.forEach(row=>groups[row[args.group_by]]=(groups[row[args.group_by]]||0)+1);return Object.entries(groups).map(([key,total])=>({[args.group_by]:key,total}));}
            if(typeof args.fields[0]==='object')return [{total:filtered.length}];
            if(!isSummary&&flags.late)return flags.late;
            return filtered.slice(args.limit_start||0,(args.limit_start||0)+args.limit_page_length);
        }};
    vm.runInNewContext(source,{frappe,$:()=>events,document:{},setTimeout,clearTimeout,Date});
    const click=(action,extra={})=>app.fire('click',{target:{closest:()=>({dataset:{action,...extra},disabled:false})}});
    const ready=frappe.assetsiq_employee_dashboard(root);
    return {root,app,refresh,search,form,clear,regions,cards,filterButtons,calls,routes,handlers,flags,click,ready,
        setData:data=>records=data,setRoute:value=>route=value,seed};
}
(async()=>{
    const h=harness();await h.ready;
    assert.deepEqual(h.cards.map(card=>card.textContent),['7','4','1','1','1']);
    assert.ok(h.regions.queue.innerHTML.includes('Haldwani Office'));
    assert.ok(h.regions.queue.innerHTML.includes('&lt;script&gt;'));
    assert.ok(!h.regions.queue.innerHTML.includes('Other user secret'));
    assert.ok(h.regions.queue.innerHTML.includes('Review request'));
    assert.ok(h.regions.mix.innerHTML.includes('Laptop'));
    assert.ok(h.regions.recent.innerHTML.includes('1 hour ago'));
    h.click('my-assets');assert.equal(h.routes.at(-1).filters.assigned_to,'employee@example.test');
    h.click('maintenance-list');assert.deepEqual(h.routes.at(-1).filters.asset_status,['in',['Maintenance Requested','Under Maintenance']]);
    h.click('review',{asset:'AST-1'});assert.deepEqual(h.routes.at(-1).args,['Form','Asset','AST-1']);
    h.click('next');await settle();assert.equal(h.root.assetsiqEmployeeDashboard.state.start,5);
    assert.ok(h.regions.pagination.innerHTML.includes('6–7 of 7'));
    h.click('previous');await settle();assert.equal(h.root.assetsiqEmployeeDashboard.state.start,0);
    h.click('filter',{filter:'pending'});await settle();assert.ok(h.regions.queue.innerHTML.includes('Review request'));
    assert.equal(h.filterButtons.find(b=>b.dataset.filter==='pending').attrs['aria-pressed'],'true');
    h.search.value='SN-1';h.form.fire('submit',{preventDefault(){}});await settle();
    assert.equal(h.root.assetsiqEmployeeDashboard.state.total,1);
    const before=h.calls.length;h.click('refresh');await settle();assert.ok(h.calls.length>before);assert.equal(h.root.assetsiqEmployeeDashboard.state.mode,'pending');
    h.search.value='SN-6';h.form.fire('submit',{preventDefault(){}});await settle();assert.ok(h.regions.queue.textContent.includes('No matching equipment'));
    h.click('clear-search');await settle();assert.equal(h.search.value,'');assert.equal(h.search.focused,true);
    let stopped=0,prevented=0;h.search.fire('keydown',{stopPropagation(){stopped++;},preventDefault(){prevented++;}});assert.equal(stopped,1);assert.equal(prevented,0);
    let resolveLate;h.flags.late=new Promise(resolve=>resolveLate=resolve);
    const old=h.root.assetsiqEmployeeDashboard.loadQueue();
    h.flags.late=null;h.click('filter',{filter:'assigned'});await settle();
    resolveLate([{...h.seed[0],asset_name:'Stale data'}]);await old;
    assert.ok(!h.regions.queue.innerHTML.includes('Stale data'));
    h.flags.failQueue=true;await h.root.assetsiqEmployeeDashboard.loadQueue();assert.ok(h.regions.queue.textContent.includes('Could not load your equipment'));
    h.flags.failQueue=false;h.flags.failSummary=true;await h.root.assetsiqEmployeeDashboard.refresh();
    assert.equal(h.regions.message.hidden,false);assert.equal(h.refresh.disabled,false);assert.equal(h.cards[0].textContent,'7');
    h.flags.failSummary=false;h.setData([]);await h.root.assetsiqEmployeeDashboard.refresh();
    assert.equal(h.cards[0].textContent,'0');assert.ok(h.regions.mix.innerHTML.includes('no equipment'));
    h.click('filter',{filter:'pending'});await settle();assert.ok(h.regions.queue.textContent.includes('No assignments'));
    const callsBefore=h.calls.length;h.setRoute(['Form','Asset','AST-1']);h.handlers['page-change.assetsiq-employee-dashboard']();assert.equal(h.calls.length,callsBefore);
    h.setRoute(['Workspaces','AssetsIQ — My Workspace']);h.handlers['page-change.assetsiq-employee-dashboard']();await settle();assert.ok(h.calls.length>callsBefore);
    const count=h.calls.length;await h.root.assetsiqEmployeeDashboard.refresh();
    assert.equal(h.calls.length,count+5); // 3 summary queries + rows + filtered count.
    const staff=harness('it@example.test');await staff.ready;assert.equal(staff.cards[0].textContent,'7');
    assert.ok(staff.calls.every(args=>args.filters.assigned_to==='it@example.test'));
    console.log('Employee dashboard checks passed: owned counts/rows/categories/updates, staff self-scope, filters, search, pagination, native review, escaping, Refresh, keyboard handling, stale responses, empty/error states and return navigation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
