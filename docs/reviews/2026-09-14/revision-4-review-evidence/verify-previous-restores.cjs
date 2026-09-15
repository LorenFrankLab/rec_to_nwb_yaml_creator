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
  // Cancel remains available after starting a restore; the continuation survives closing the panel.
  {
   const c = await browser.newContext(); const p = await blank(c); const ws = await seed(p);
   await p.goto(base + '/#/workspace'); await role(p,'writer');
   const backup = await makeBackup(p,ws,480);
   await chooseBackup(p,backup); await p.evaluate(holdWriteAcknowledgements);
   await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
   await expect.poll(() => p.evaluate(() => window.__held.length)).toBeGreaterThan(0);
   result.cancelledRestore = {cancelEnabled:await p.getByRole('button',{name:'Cancel',exact:true}).isEnabled()};
   await p.getByRole('button',{name:'Cancel',exact:true}).click();
   await expect(p.getByRole('alertdialog')).toHaveCount(0);
   await p.goto(base + '/#/day/remy-2023-06-22');
   await p.getByLabel('Weight measured today (grams)').fill('777'); await p.keyboard.press('Control+s');
   await expect.poll(() => p.evaluate(k=>JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].session.weight,key)).toBe(777);
   result.cancelledRestore.savedAfterCancel = 777;
   await p.evaluate(() => window.__releaseWrites());
   await expect.poll(() => p.evaluate(k=>JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].session.weight,key)).toBe(777);
   result.cancelledRestore.storedAfterCancelledRestoreCompletes = 777;
   result.cancelledRestore.visibleWeight = await p.getByLabel('Weight measured today (grams)').inputValue();
   await c.close();
  }
  // A storage failure is reported as 'Nothing was replaced', but memory and receipt bytes change.
  {
   const c = await browser.newContext(); const p = await blank(c); const ws = await seed(p);
   await p.goto(base + '/#/day/remy-2023-06-22'); await role(p,'writer');
   await p.getByRole('button',{name:'Export',exact:true}).click();
   const downloaded = p.waitForEvent('download'); await p.getByRole('button',{name:'Download',exact:true}).click(); await downloaded;
   await expect.poll(() => p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').workspace?.days['remy-2023-06-22']?.exportReceipt?.yamlStored,key)).toBe(true);
   const before = await p.evaluate(async k => {
    const {getBlob} = await import('/src/state/blobStore.ts');
    const day = JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'];
    return {receipt:day.exportReceipt,artifact:await getBlob('receipt:remy-2023-06-22')};
   },key);
   const backup = await makeBackup(p,ws,480);
   await p.goto(base + '/#/workspace'); await chooseBackup(p,backup);
   await p.evaluate(k => {
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){if(name===k)throw new DOMException('Quota full','QuotaExceededError');return original.call(this,name,value);};
   },key);
   await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
   const refusal=p.getByRole('alertdialog').getByRole('alert');
   await expect(refusal).toContainText('Nothing was replaced.');
   result.failedRestore = {refusal:await refusal.innerText(),originalReceiptHash:before.receipt.contentHash};
   await p.getByRole('button',{name:'Cancel',exact:true}).click();
   await p.goto(base + '/#/day/remy-2023-06-22');
   result.failedRestore.inMemoryWeightAfterRefusal = await p.getByLabel('Weight measured today (grams)').inputValue();
   result.failedRestore.persistedWeightAfterRefusal = await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].session.weight,key);
   await p.reload();
   result.failedRestore.weightAfterReload = await p.getByLabel('Weight measured today (grams)').inputValue();
   result.failedRestore.storedArtifact = await p.evaluate(async k => {
    const {getBlob}=await import('/src/state/blobStore.ts');
    const {receiptHash}=await import('/src/domain/exportReceipt.ts');
    const artifact=await getBlob('receipt:remy-2023-06-22');
    const receipt=JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].exportReceipt;
    return {weightLine:artifact.yaml.split('\n').find(x=>/^\s+weight:/.test(x)),hash:receiptHash(artifact.filename,artifact.yaml),receiptHash:receipt.contentHash,yamlStored:receipt.yamlStored};
   },key);
   await p.getByLabel('Weight measured today (grams)').fill('499'); await p.keyboard.press('Control+s');
   await p.getByRole('button',{name:'Export',exact:true}).click();
   await p.getByText(/Show what changed/).click();
   result.failedRestore.displayedComparison = await p.getByLabel('Changes since the last download').innerText();
   await c.close();
  }
 } finally {await browser.close();console.log(JSON.stringify(result,null,2));fs.writeFileSync('/tmp/revision4-previous.json',JSON.stringify(result,null,2)+'\n');}
})().catch(err=>{console.error(err);process.exitCode=1;});
