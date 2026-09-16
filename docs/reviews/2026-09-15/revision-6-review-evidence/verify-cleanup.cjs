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
 const browser=await chromium.launch();
 try {
  const c=await browser.newContext(); const p=await blank(c); await seed(p);
  const backup=await p.evaluate(async k=>{
   const {currentExportArtifact}=await import('/src/domain/exportReceipt.ts');
   const {putBlob}=await import('/src/state/blobStore.ts');
   const {serializeWorkspaceBackup}=await import('/src/state/persistence.ts');
   const ws=JSON.parse(localStorage.getItem(k)).workspace;
   const d=ws.days['remy-2023-06-22'];
   const earlier={...structuredClone(d),id:'remy-2023-06-21',date:'2023-06-21',session:{...d.session,session_id:'remy_20230621'}};
   ws.days={[earlier.id]:earlier,[d.id]:d};ws.animals.remy.days=[earlier.id,d.id];
   for(const day of Object.values(ws.days)){
    const exported=currentExportArtifact(ws.animals.remy,day);
    const artifact={filename:exported.filename,yaml:exported.yaml,exportedAt:'2023-06-22T00:00:00Z'};
    day.exportReceipt={filename:artifact.filename,exportedAt:artifact.exportedAt,contentHash:exported.hash,yamlStored:true,appVersion:'test',schemaVersion:4};
    const storageKey='receipt:'+day.id+(day.id===earlier.id?':previous-restore':'');
    if(day.id===earlier.id)day.exportReceipt.yamlKey=storageKey;
    await putBlob(storageKey,artifact);
   }
   localStorage.setItem(k,JSON.stringify({schemaVersion:4,workspace:ws}));
   const incoming=structuredClone(ws);const artifacts={};
   for(const day of Object.values(incoming.days)){
    day.session.weight=480;
    const exported=currentExportArtifact(incoming.animals.remy,day);
    artifacts[day.id]={filename:exported.filename,yaml:exported.yaml,exportedAt:'2023-06-22T01:00:00Z'};
    day.exportReceipt={filename:exported.filename,exportedAt:artifacts[day.id].exportedAt,contentHash:exported.hash,yamlStored:true,appVersion:'test',schemaVersion:4};
   }
   return serializeWorkspaceBackup(incoming,'test',artifacts);
  },key);
  await p.goto(base+'/#/workspace');await role(p,'writer');
  await p.evaluate(()=>{
   window.__cleanupHeld=[];window.__deletedKeys=[];window.__cleanupReleased=false;
   const originalDelete=IDBObjectStore.prototype.delete;
   IDBObjectStore.prototype.delete=function(name){window.__deletedKeys.push(name);if(name==='receipt:remy-2023-06-21:previous-restore')this.transaction.__holdCleanup=true;return originalDelete.call(this,name);};
   const originalTx=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(...args){const tx=originalTx.apply(this,args);Object.defineProperty(tx,'oncomplete',{configurable:true,set(fn){tx.addEventListener('complete',e=>{if(tx.__holdCleanup)window.__cleanupHeld.push(()=>{fn.call(tx,e);setTimeout(()=>window.__cleanupReleased=true,0);});else fn.call(tx,e);});}});return tx;};
  });
  await chooseBackup(p,backup);await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
  await expect(p.getByRole('alertdialog')).toHaveCount(0);
  await expect.poll(()=>p.evaluate(()=>window.__cleanupHeld.length)).toBe(1);
  result.cleanup={restoreSucceeded:true};
  await p.goto(base+'/#/day/remy-2023-06-22');
  await p.getByRole('button',{name:'Export',exact:true}).click();
  const downloaded=p.waitForEvent('download');await p.getByRole('button',{name:'Download',exact:true}).click();await downloaded;
  await expect.poll(()=>p.evaluate(k=>{
   const receipt=JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].exportReceipt;
   return receipt.yamlStored===true&&!receipt.yamlKey;
  },key)).toBe(true);
  result.cleanup.beforeCleanup=await p.evaluate(async k=>{
   const {getBlob}=await import('/src/state/blobStore.ts');const {receiptYamlKey,receiptHash}=await import('/src/domain/exportReceipt.ts');
   const receipt=JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].exportReceipt;
   const name=receiptYamlKey('remy-2023-06-22',receipt);const artifact=await getBlob(name);
   return {key:name,yamlStored:receipt.yamlStored,artifactMatches:receiptHash(artifact.filename,artifact.yaml)===receipt.contentHash};
  },key);
  await p.evaluate(()=>window.__cleanupHeld.shift()());
  await expect.poll(()=>p.evaluate(()=>window.__cleanupReleased)).toBe(true);
  result.cleanup.deletedKeys=await p.evaluate(()=>window.__deletedKeys);
  expect(result.cleanup.deletedKeys).toEqual(['receipt:remy-2023-06-21:previous-restore']);
  await p.reload();
  result.cleanup.afterReload=await p.evaluate(async k=>{
   const {getBlob}=await import('/src/state/blobStore.ts');const {receiptYamlKey,receiptHash}=await import('/src/domain/exportReceipt.ts');const {buildWorkspaceBackup}=await import('/src/state/persistence.ts');
   const receipt=JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].exportReceipt;
   const artifact=await getBlob(receiptYamlKey('remy-2023-06-22',receipt));
   const ws=JSON.parse(localStorage.getItem(k)).workspace;const backup=JSON.parse(await buildWorkspaceBackup(ws,'review'));
   return {yamlStored:receipt.yamlStored,artifactMatches:!!artifact&&receiptHash(artifact.filename,artifact.yaml)===receipt.contentHash,backupIncludesArtifact:!!artifact&&backup.artifacts['remy-2023-06-22']?.yaml===artifact.yaml};
  },key);
  expect(result.cleanup.afterReload).toEqual({yamlStored:true,artifactMatches:true,backupIncludesArtifact:true});
  await p.getByLabel('Weight measured today (grams)').fill('499');await p.keyboard.press('Control+s');
  await p.getByRole('button',{name:'Export',exact:true}).click();
  await p.getByText(/Show what changed/).click();
  const diff=p.getByLabel('Changes since the last download');await expect(diff).toContainText('weight: 480');await expect(diff).toContainText('weight: 499');
  result.cleanup.comparisonCorrectAfterEdit=true;
  await c.close();
 }finally{await browser.close();console.log(JSON.stringify(result,null,2));fs.writeFileSync('/tmp/revision6-cleanup.json',JSON.stringify(result,null,2)+'\n');}
})().catch(err=>{console.error(err);process.exitCode=1;});
