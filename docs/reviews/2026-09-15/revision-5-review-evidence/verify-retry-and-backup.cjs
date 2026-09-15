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
  const c=await browser.newContext();const p=await blank(c);const ws=await seed(p);
  await p.goto(base+'/#/workspace');await role(p,'writer');
  const a=await makeBackup(p,ws,480);const b=await makeBackup(p,ws,499);
  await p.evaluate(()=>{
   window.__restoreAcks=[];
   const originalPut=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(value,name){if(String(name).includes(':restore-'))this.transaction.__restoreKey=name;return originalPut.call(this,value,name);};
   const originalTx=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(...args){const tx=originalTx.apply(this,args);Object.defineProperty(tx,'oncomplete',{configurable:true,set(fn){tx.addEventListener('complete',e=>{if(tx.__restoreKey)window.__restoreAcks.push({key:tx.__restoreKey,release:()=>fn.call(tx,e)});else fn.call(tx,e);});}});return tx;};
  });
  await chooseBackup(p,a);await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
  await expect.poll(()=>p.evaluate(()=>window.__restoreAcks.length)).toBe(1);
  await p.getByRole('button',{name:'Cancel',exact:true}).click();
  await chooseBackup(p,b);await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
  await expect.poll(()=>p.evaluate(()=>window.__restoreAcks.length)).toBe(2);
  const keys=await p.evaluate(()=>window.__restoreAcks.map(x=>x.key));expect(keys[0]).not.toBe(keys[1]);
  await p.evaluate(()=>window.__restoreAcks.shift().release());
  await expect.poll(()=>p.evaluate(async name=>{const {getBlob}=await import('/src/state/blobStore.ts');return (await getBlob(name))??null;},keys[0])).toBeNull();
  expect(await p.evaluate(async name=>{const {getBlob}=await import('/src/state/blobStore.ts');return Boolean(await getBlob(name));},keys[1])).toBe(true);
  await p.evaluate(()=>window.__restoreAcks.shift().release());
  await expect(p.getByRole('alertdialog')).toHaveCount(0);await p.reload();
  result.retryAndBackup=await p.evaluate(async k=>{
   const {getBlob}=await import('/src/state/blobStore.ts');const {receiptYamlKey,receiptHash}=await import('/src/domain/exportReceipt.ts');const {buildWorkspaceBackup}=await import('/src/state/persistence.ts');
   const ws=JSON.parse(localStorage.getItem(k)).workspace;const day=ws.days['remy-2023-06-22'];const receipt=day.exportReceipt;
   const artifact=await getBlob(receiptYamlKey(day.id,receipt));const backup=JSON.parse(await buildWorkspaceBackup(ws,'review'));
   return {weight:day.session.weight,yamlStored:receipt.yamlStored,artifactMatches:receiptHash(artifact.filename,artifact.yaml)===receipt.contentHash,backupIncludesArtifact:backup.artifacts[day.id]?.yaml===artifact.yaml};
  },key);
  expect(result.retryAndBackup).toEqual({weight:499,yamlStored:true,artifactMatches:true,backupIncludesArtifact:true});
  await p.goto(base+'/#/day/remy-2023-06-22');await p.getByLabel('Weight measured today (grams)').fill('505');await p.keyboard.press('Control+s');
  await p.getByRole('button',{name:'Export',exact:true}).click();await p.getByText(/Show what changed/).click();
  const diff=p.getByLabel('Changes since the last download');await expect(diff).toContainText('weight: 499');await expect(diff).toContainText('weight: 505');
  result.retryAndBackup.comparisonCorrectAfterEdit=true;
  await c.close();
 }finally{await browser.close();console.log(JSON.stringify(result,null,2));fs.writeFileSync('/tmp/revision5-verify.json',JSON.stringify(result,null,2)+'\n');}
})().catch(err=>{console.error(err);process.exitCode=1;});
