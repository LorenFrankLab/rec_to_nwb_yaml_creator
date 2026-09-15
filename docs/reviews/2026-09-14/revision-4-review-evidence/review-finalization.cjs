const {chromium, expect} = require(require('path').resolve(process.cwd(), 'node_modules/@playwright/test'));
const fs = require('fs');
const base = process.env.REVIEW_BASE_URL || 'http://127.0.0.1:3013';
const key = 'rec_to_nwb_workspace_v1';
const result = {};
async function blank(c) {
  const p = await c.newPage();
  p.setDefaultTimeout(10000);
  await p.route('**/__rereview_blank__', r => r.fulfill({contentType:'text/html', body:'<html></html>'}));
  await p.goto(base + '/__rereview_blank__');
  return p;
}
async function seed(p) {
  return p.evaluate(async () => {
    const {buildRealisticWorkspace} = await import('/src/__tests__/fixtures/workspaceBuilders.js');
    const {createDefaultWorkspace} = await import('/src/state/workspaceUtils.ts');
    const {animal, day} = buildRealisticWorkspace();
    const ws = createDefaultWorkspace();
    day.experimenters = structuredClone(animal.experimenters); day.optogenetics = null;
    ws.animals.remy = animal; ws.days[day.id] = day;
    localStorage.setItem('rec_to_nwb_workspace_v1', JSON.stringify({schemaVersion:4, workspace:ws}));
    return ws;
  });
}
async function role(p, expected) {
  await expect.poll(() => p.evaluate(async () => (await import('/src/state/writerLock.ts')).getWriterState().role)).toBe(expected);
}
function holdWriteAcknowledgements() {
  window.__held = []; window.__holdWrites = true;
  const original = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function(...args) {
    const tx = original.apply(this, args);
    if (args[1] === 'readwrite') {
      Object.defineProperty(tx, 'oncomplete', {configurable:true, set(fn) {
        tx.addEventListener('complete', e => {
          if (window.__holdWrites) window.__held.push(() => fn.call(tx, e));
          else fn.call(tx, e);
        });
      }});
    }
    return tx;
  };
  window.__releaseWrites = () => { window.__holdWrites = false; window.__held.splice(0).forEach(fn => fn()); };
}
async function makeBackup(p, ws, weight) {
 return p.evaluate(async ({ws,weight}) => {
  const {currentExportArtifact} = await import('/src/domain/exportReceipt.ts');
  const {serializeWorkspaceBackup} = await import('/src/state/persistence.ts');
  const day = ws.days['remy-2023-06-22']; day.session.weight = weight;
  const exported = currentExportArtifact(ws.animals.remy,day);
  const artifact = {filename:exported.filename,yaml:exported.yaml,exportedAt:'2023-06-22T00:00:00Z'};
  day.exportReceipt = {filename:artifact.filename,exportedAt:artifact.exportedAt,contentHash:exported.hash,yamlStored:true,appVersion:'test',schemaVersion:4};
  return serializeWorkspaceBackup(ws,'test',{[day.id]:artifact});
 },{ws:structuredClone(ws),weight});
}
async function chooseBackup(p,backup) {
 await p.locator('input[type=file]').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 await expect(p.getByRole('button',{name:'Replace workspace',exact:true})).toBeVisible();
}
(async () => {
 const browser = await chromium.launch();
 try {
  // The first localStorage write succeeds, but the separate revision marker write fails.
  {
   const c = await browser.newContext(); const p = await blank(c); const ws = await seed(p);
   await p.goto(base + '/#/workspace'); await role(p,'writer');
   const backup = await makeBackup(p,ws,480); await chooseBackup(p,backup);
   await p.evaluate(k=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){if(name===k+'.meta')throw new DOMException('Quota full on revision marker','QuotaExceededError');return original.call(this,name,value);};
   },key);
   await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
   const refusal=p.getByRole('alertdialog').getByRole('alert');
   await expect(refusal).toContainText('Nothing was replaced.');
   result.revisionWriteFailure={refusal:await refusal.innerText(),savedWeight:await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].session.weight,key)};
   await p.getByRole('button',{name:'Cancel',exact:true}).click();
   await p.goto(base+'/#/day/remy-2023-06-22');
   result.revisionWriteFailure.memoryWeight = await p.getByLabel('Weight measured today (grams)').inputValue();
   const second = await c.newPage();
   await second.goto(base+'/#/day/remy-2023-06-22'); await role(second,'reader');
   result.revisionWriteFailure.weightInSecondTab = await second.getByLabel('Weight measured today (grams)').inputValue();
   await c.close();
  }
  // Staging is durable, but the later active-key promotion is rejected by IndexedDB.
  {
   const c=await browser.newContext(); const p=await blank(c); const ws=await seed(p);
   await p.goto(base+'/#/workspace'); await role(p,'writer');
   const backup=await makeBackup(p,ws,480); await chooseBackup(p,backup);
   await p.evaluate(()=>{
    window.__promotionFailures=0;
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,name){
     if(name==='receipt:remy-2023-06-22'){window.__promotionFailures++;throw new DOMException('No room for promoted receipt','QuotaExceededError');}
     return original.call(this,value,name);
    };
   });
   await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
   await expect(p.getByRole('alertdialog')).toHaveCount(0);
   await expect.poll(()=>p.evaluate(()=>window.__promotionFailures)).toBe(1);
   await expect.poll(()=>p.evaluate(async()=>{
    const {getBlob}=await import('/src/state/blobStore.ts');
    return (await getBlob('receipt-staging:remy-2023-06-22'))??null;
   })).toBeNull();
   result.promotionFailure={successNotice:await p.getByText('Workspace restored from "restore.json".',{exact:true}).innerText()};
   await p.reload();
   result.promotionFailure.afterReload=await p.evaluate(async k=>{
    const {getBlob}=await import('/src/state/blobStore.ts');
    const day=JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'];
    return {yamlStored:day.exportReceipt.yamlStored,activeArtifact:(await getBlob('receipt:remy-2023-06-22'))??null,stagedArtifact:(await getBlob('receipt-staging:remy-2023-06-22'))??null};
   },key);
   await c.close();
  }
  // Cancelling one restore allows a new restore to reuse its still-live staging key.
  {
   const c=await browser.newContext(); const p=await blank(c); const ws=await seed(p);
   await p.goto(base+'/#/workspace'); await role(p,'writer');
   const a=await makeBackup(p,ws,480); const b=await makeBackup(p,ws,499);
   await p.evaluate(()=>{
    window.__stagingAcks=[];
    const origTx=IDBDatabase.prototype.transaction; const origPut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,name){if(String(name).startsWith('receipt-staging:'))this.transaction.__stageKey=name;return origPut.call(this,value,name);};
    IDBDatabase.prototype.transaction=function(...args){const tx=origTx.apply(this,args);Object.defineProperty(tx,'oncomplete',{configurable:true,set(fn){tx.addEventListener('complete',e=>{if(tx.__stageKey)window.__stagingAcks.push(()=>fn.call(tx,e));else fn.call(tx,e);});}});return tx;};
   });
   await chooseBackup(p,a); await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
   await expect.poll(()=>p.evaluate(()=>window.__stagingAcks.length)).toBe(1);
   await p.getByRole('button',{name:'Cancel',exact:true}).click();
   await chooseBackup(p,b); await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
   await expect.poll(()=>p.evaluate(()=>window.__stagingAcks.length)).toBe(2);
   await p.evaluate(()=>window.__stagingAcks.shift()()); // cancelled A cleans its key; that key now holds B
   await expect.poll(()=>p.evaluate(async()=>{
    const {getBlob}=await import('/src/state/blobStore.ts');return (await getBlob('receipt-staging:remy-2023-06-22'))??null;
   })).toBeNull();
   await p.evaluate(()=>window.__stagingAcks.shift()()); // B still believes its staging write is durable
   await expect(p.getByRole('alertdialog')).toHaveCount(0);
   await p.reload();
   result.cancelThenRetry=await p.evaluate(async k=>{
    const {getBlob}=await import('/src/state/blobStore.ts');const day=JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'];
    return {restoredWeight:day.session.weight,yamlStored:day.exportReceipt.yamlStored,activeArtifact:(await getBlob('receipt:remy-2023-06-22'))??null,stagedArtifact:(await getBlob('receipt-staging:remy-2023-06-22'))??null};
   },key);
   await c.close();
  }
 }finally{await browser.close();console.log(JSON.stringify(result,null,2));fs.writeFileSync('/tmp/revision4-repro.json',JSON.stringify(result,null,2)+'\n');}
})().catch(err=>{console.error(err);process.exitCode=1;});
