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
(async () => {
 const browser = await chromium.launch();
 try {
  // A quarantine acknowledgement arrives after an explicit save of newly entered data.
  {
   const c = await browser.newContext(); const p = await blank(c);
   await p.evaluate(k => localStorage.setItem(k, '{unreadable scientific original'), key);
   await p.addInitScript(holdWriteAcknowledgements);
   await p.goto(base + '/#/workspace'); await role(p, 'writer');
   await expect.poll(() => p.evaluate(() => window.__held.length)).toBeGreaterThan(0);
   await p.getByRole('button', {name:'Create Animal', exact:true}).first().click();
   await p.getByRole('textbox', {name:'Subject ID', exact:true}).fill('NewData');
   await p.getByLabel('Weight (grams)').fill('450');
   await p.getByLabel('Date of Birth').fill('2023-01-01');
   await p.getByRole('button', {name:'Save draft', exact:true}).click();
   await expect(p).toHaveURL(/animal\/NewData\/days/);
   await p.keyboard.press('Control+s');
   result.pendingRecovery = {beforeAcknowledgement:await p.evaluate(k => Object.keys(JSON.parse(localStorage.getItem(k)).workspace.animals), key)};
   await p.evaluate(() => window.__releaseWrites());
   await expect.poll(() => p.evaluate(k => localStorage.getItem(k), key)).toBeNull();
   result.pendingRecovery.afterAcknowledgement = await p.evaluate(k => localStorage.getItem(k), key);
   await p.reload();
   result.pendingRecovery.newAnimalAfterReload = await p.getByRole('heading', {name:'NewData', exact:true}).count();
   await c.close();
  }
  // Restore relinquishes ownership while waiting for receipt side-store work, then overwrites B.
  {
   const c = await browser.newContext(); const a = await blank(c); const ws = await seed(a);
   await a.goto(base + '/#/workspace'); await role(a,'writer');
   const b = await c.newPage(); await b.goto(base + '/#/day/remy-2023-06-22'); await role(b,'reader');
   const backup = await a.evaluate(async ws => {
     const {receiptHash} = await import('/src/domain/exportReceipt.ts');
     const {serializeWorkspaceBackup} = await import('/src/state/persistence.ts');
     const day = ws.days['remy-2023-06-22']; day.session.weight = 480;
     const artifact = {filename:'20230622_remy_metadata.yml', yaml:'subject: remy\n', exportedAt:'2023-06-22T00:00:00Z'};
     day.exportReceipt = {...artifact, contentHash:receiptHash(artifact.filename,artifact.yaml), yamlStored:true, appVersion:'test', schemaVersion:4};
     return serializeWorkspaceBackup(ws, 'test', {[day.id]:artifact});
   },ws);
   await a.locator('input[type=file]').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(backup)});
   await expect(a.getByRole('button',{name:'Replace workspace',exact:true})).toBeVisible();
   await a.evaluate(holdWriteAcknowledgements);
   await a.getByRole('button',{name:'Replace workspace',exact:true}).click();
   await expect.poll(() => a.evaluate(() => window.__held.length)).toBeGreaterThan(0);
   await b.getByRole('button',{name:'Edit in this tab instead',exact:true}).click();
   await role(b,'writer'); await role(a,'reader');
   await b.getByLabel('Weight measured today (grams)').fill('777'); await b.keyboard.press('Control+s');
   await expect.poll(() => b.evaluate(k=>JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].session.weight,key)).toBe(777);
   result.restoreHandover = {writerSavedWeight:777, restoringTabRole:'reader'};
   await a.evaluate(() => window.__releaseWrites());
   await expect.poll(() => b.evaluate(k=>JSON.parse(localStorage.getItem(k)).workspace.days['remy-2023-06-22'].session.weight,key)).toBe(480);
   result.restoreHandover.storedWeightAfterReaderRestore = 480;
   result.restoreHandover.writerVisibleWeight = await b.getByLabel('Weight measured today (grams)').inputValue();
   await c.close();
  }
  // Restore bypasses the guard that requires preserving/downloading an unreadable original.
  {
   const c = await browser.newContext(); const p = await blank(c); const ws = await seed(p);
   await p.evaluate(k=>localStorage.setItem(k,'{original that must be downloaded first'),key);
   await p.addInitScript(() => {
    Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k,v) {
     if (k === 'rec_to_nwb_workspace_v1.quarantine') throw new DOMException('Quota full','QuotaExceededError');
     return original.call(this,k,v);
    };
   });
   await p.goto(base + '/#/workspace'); await role(p,'writer');
   await expect(p.getByText(/Nothing will be saved.*until you download the original/)).toBeVisible();
   result.restoreUnpreserved = {before:await p.evaluate(k=>localStorage.getItem(k),key)};
   await p.locator('input[type=file]').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:4,workspace:ws}))});
   await p.getByRole('button',{name:'Replace workspace',exact:true}).click();
   await expect.poll(() => p.evaluate(k=>localStorage.getItem(k),key)).not.toBe(result.restoreUnpreserved.before);
   result.restoreUnpreserved.afterAnimals = await p.evaluate(k=>Object.keys(JSON.parse(localStorage.getItem(k)).workspace.animals),key);
   await p.reload();
   result.restoreUnpreserved.originalAfterReload = await p.evaluate(async () => (await import('/src/state/persistence.ts')).readPreservedBlob('rec_to_nwb_workspace_v1.quarantine'));
   await c.close();
  }
  // Derived confirmation must consider the END of the pinned setup's effective interval.
  {
   const c = await browser.newContext(); const p = await blank(c);
   result.domain = await p.evaluate(async () => {
    const {buildRealisticWorkspace} = await import('/src/__tests__/fixtures/workspaceBuilders.js');
    const {createDefaultWorkspace} = await import('/src/state/workspaceUtils.ts');
    const {createWorkspaceActions} = await import('/src/state/workspaceActions.ts');
    const {configurationChoiceStatus, selectConfigurationForDate} = await import('/src/domain/configurationSelection.ts');
    const {configurationChoiceIssues} = await import('/src/domain/datedFactsValidation.ts');
    const {animal} = buildRealisticWorkspace();
    animal.configurationHistory = [{...animal.configurationHistory[0],version:1,date:'2023-06-01',effectiveDateKnown:true},{...structuredClone(animal.configurationHistory[0]),version:2,date:'2023-07-01',effectiveDateKnown:true}];
    const ref = {current:createDefaultWorkspace()}; ref.current.animals.remy = animal;
    const actions = createWorkspaceActions({workspaceRef:ref,commitWorkspace:fn=>{ref.current=fn(ref.current);}});
    actions.createDay('remy','2023-06-25',{session_id:'test',session_description:'recorded before correction'});
    actions.setConfigurationEffectiveDate('remy',2,'2023-06-20');
    const updated = ref.current.animals.remy; const day = ref.current.days['remy-2023-06-25'];
    return {pinned:day.configurationVersion,selected:selectConfigurationForDate(updated,day.date),status:configurationChoiceStatus(updated,day),issues:configurationChoiceIssues(day,updated)};
   });
   await c.close();
  }
  // A false durability acknowledgement is ignored when restoring receipt artifacts.
  {
   const c = await browser.newContext(); const p = await blank(c);
   result.artifactDurability = await p.evaluate(async () => {
    Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});
    const {restoreBackupArtifacts} = await import('/src/state/persistence.ts');
    const {receiptHash,RECEIPT_YAML_KEY_PREFIX} = await import('/src/domain/exportReceipt.ts');
    const {resetBlobStoreForTests,getBlob} = await import('/src/state/blobStore.ts');
    const artifact = {filename:'20230622_remy_metadata.yml',yaml:'subject: remy\n',exportedAt:'2023-06-22T00:00:00Z'};
    const ws = {days:{d:{exportReceipt:{yamlStored:true,contentHash:receiptHash(artifact.filename,artifact.yaml)}}}};
    const next = await restoreBackupArtifacts(ws,{d:artifact});
    resetBlobStoreForTests();
    return {yamlStored:next.days.d.exportReceipt.yamlStored,artifactAfterMemoryReset:(await getBlob(RECEIPT_YAML_KEY_PREFIX+'d'))??null};
   });
   await c.close();
  }
 } finally { await browser.close(); console.log(JSON.stringify(result,null,2)); fs.writeFileSync('/tmp/branch-rereview-repro.json',JSON.stringify(result,null,2)+'\n'); }
})().catch(err=>{console.error(err);process.exitCode=1;});
