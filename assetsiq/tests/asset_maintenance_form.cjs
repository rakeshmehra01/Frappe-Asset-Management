const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2] || require('node:path').join(__dirname, '../assetsiq/doctype/asset_maintenance/asset_maintenance.js'), 'utf8');
let handlers;
const frappe={session:{user:'employee@example.test'},user_roles:['AssetsIQ Employee'],ui:{form:{on:(name,value)=>{assert.equal(name,'Asset Maintenance');handlers=value;}}},db:{get_value:async()=>({message:{asset_name:'Laptop'}})}};
vm.runInNewContext(source,{frappe});
const queries={},properties=[],changes=[];
const frm={doc:{asset_name:'AST-1',status:'Requested'},is_new:()=>true,set_query:(name,fn)=>queries[name]=fn,
    set_df_property:(...args)=>properties.push(args),disable_save:()=>changes.push('disabled'),set_value:(...args)=>changes.push(args)};
(async()=>{
handlers.setup(frm);assert.equal(queries.asset_name().filters.assigned_to,'employee@example.test');
assert.ok(queries.handled_by().query.endsWith('.technician_query'));
handlers.refresh(frm);assert.ok(properties.some(([field,key,value])=>field==='asset_name'&&value===false));
await handlers.asset_name(frm);assert.ok(changes.some(value=>value[0]==='asset_title'&&value[1]==='Laptop'));
frm.is_new=()=>false;frm.doc.status='In Progress';handlers.refresh(frm);assert.ok(changes.includes('disabled'));
frappe.user_roles=['AssetsIQ IT'];handlers.setup(frm);assert.equal(queries.asset_name().filters.assigned_to,undefined);
console.log('Maintenance form checks passed: owned asset selection, IT controls, read-only processed requests and display name.');
})().catch(error=>{console.error(error);process.exitCode=1;});
