const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.env.ASSET_ACTION_TEST_SOURCE || path.join(__dirname, '../assetsiq/doctype/asset/asset.js'),'utf8');
function harness(options={}) {
    let handler;
    const state={buttons:new Map(), calls:[], reloads:0, syncs:0, alerts:[], dirty:!!options.dirty};
    const frappe={session:{user:options.user || 'recipient@example.test'},ui:{form:{on:(_,events)=>{handler=events.refresh;}}},
        xcall:async (method,args)=>{
            state.calls.push({method,args});
            if(method.endsWith('get_transitions')) {
                if (options.defer) return new Promise(resolve=>{state.resolve=resolve;});
                return (options.actions || ['Accept Assignment','Decline Assignment']).map(action=>({action,allow_self_approval:options.selfApproval ?? 1}));
            }
            const states={'Accept Assignment':'Assigned','Decline Assignment':'Available','Request Assignment':'Assignment Requested',
                'Request Maintenance':'Maintenance Requested','Approve Maintenance':'Under Maintenance','Decline Maintenance':'Assigned',
                'Complete Maintenance':'Assigned','Return to Stock':'Available','Retire Asset':'Retired'};
            return {...args.doc,asset_status:states[args.action]};
        },
        confirm:(_,callback)=>{state.confirm=callback;},model:{sync:()=>{state.syncs++;}},show_alert:value=>state.alerts.push(value),
        set_route:(...route)=>{state.route=route;},msgprint:()=>{state.message=true;},
    };
    const frm={doc:{name:'AST-00002',owner:options.owner || 'creator@example.test',assigned_to:options.recipient || 'recipient@example.test',asset_status:options.status || 'Assignment Requested'},
        set_query:()=>{},is_new:()=>!!options.isNew,is_dirty:()=>state.dirty,
        remove_custom_button:label=>state.buttons.delete(label),
        add_custom_button:(label,callback)=>{
            const button={callback,primary:false,prop:()=>button,removeClass:()=>button,addClass:()=>{button.primary=true;return button;}};
            state.buttons.set(label,button);return button;
        },reload_doc:async()=>{state.reloads++;},
    };
    vm.runInNewContext(source,{frappe,__:value=>value});
    return {state,run:()=>handler(frm)};
}
(async()=>{
    for(const options of [{isNew:true},{dirty:true}]) {
        const t=harness(options);await t.run();assert.equal(t.state.buttons.size,0);assert.equal(t.state.calls.length,0);
    }
    const unrelated=harness({user:'other@example.test'});await unrelated.run();assert.equal(unrelated.state.buttons.size,0);
    const accept=harness();await accept.run();assert.equal(accept.state.buttons.size,2);assert.ok(accept.state.buttons.get('Accept Assignment').primary);
    accept.state.buttons.get('Accept Assignment').callback();assert.equal(accept.state.calls.length,1);
    await accept.state.confirm();assert.equal(accept.state.calls[1].args.action,'Accept Assignment');assert.equal(accept.state.reloads,1);
    const decline=harness();await decline.run();decline.state.buttons.get('Decline Assignment').callback();await decline.state.confirm();
    assert.deepEqual(decline.state.route,['List','Asset']);assert.equal(decline.state.reloads,0);
    // IT can receive their own asset, while another IT user cannot confirm it.
    const itOwn=harness({user:'it@example.test',recipient:'it@example.test'});await itOwn.run();assert.equal(itOwn.state.buttons.size,2);
    const itOther=harness({user:'it@example.test',actions:[]});await itOther.run();assert.equal(itOther.state.buttons.size,0);
    for(const [status,actions] of [
        ['Available',['Request Assignment']],['Available',['Retire Asset']],
        ['Assigned',['Return to Stock']],['Assigned',['Request Maintenance']],
        ['Maintenance Requested',['Approve Maintenance','Decline Maintenance']],['Under Maintenance',['Complete Maintenance']],
    ]) {
        const t=harness({status,actions});await t.run();assert.equal(t.state.buttons.size,actions.length);
        t.state.buttons.get(actions[0]).callback();assert.equal(t.state.calls.length,1);
        await t.state.confirm();assert.equal(t.state.calls[1].args.action,actions[0]);assert.equal(t.state.reloads,1);
    }
    const deduplicated=harness({actions:['Accept Assignment','Accept Assignment']});await deduplicated.run();assert.equal(deduplicated.state.buttons.size,1);
    const noSelf=harness({owner:'recipient@example.test',selfApproval:0});await noSelf.run();assert.equal(noSelf.state.buttons.size,0);
    const dirty=harness();await dirty.run();dirty.state.dirty=true;dirty.state.buttons.get('Accept Assignment').callback();assert.equal(dirty.state.message,true);assert.equal(dirty.state.confirm,undefined);
    const stale=harness({defer:true});const promise=stale.run();stale.state.dirty=true;stale.state.resolve([{action:'Accept Assignment',allow_self_approval:1}]);await promise;assert.equal(stale.state.buttons.size,0);
    console.log('Workflow button checks passed: all configured actions, recipient protection, confirmation, IT self-receipt, deduplication, self-approval and stale-form checks.');
})().catch(error=>{console.error(error);process.exitCode=1;});
