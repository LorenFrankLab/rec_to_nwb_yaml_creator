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
  const c = await browser.newContext(); const p = await blank(c); await seed(p);
  await p.goto(base + '/#/day/remy-2023-06-22'); await role(p,'writer');
  await p.evaluate(holdWriteAcknowledgements);
  await p.getByRole('button',{name:'Export',exact:true}).click();
  const downloaded = p.waitForEvent('download');
  await p.getByRole('button',{name:'Download',exact:true}).click();
  const download = await downloaded; let yaml = '';
  for await (const chunk of await download.createReadStream()) yaml += chunk.toString();
  await expect.poll(() => p.evaluate(() => window.__held.length)).toBeGreaterThan(0);
  await p.getByRole('button',{name:/^Daily log/}).click();
  await p.getByLabel('Weight measured today (grams)').fill('499'); await p.keyboard.press('Control+s');
  await p.getByRole('button',{name:'Export',exact:true}).click();
  await expect(p.getByTestId('download-status')).toHaveAttribute('data-status','changed');
  result.freshness = {downloadedWeightLine:yaml.split('\n').find(x=>/^\s+weight:/.test(x)),beforeAcknowledgement:'changed',editedWeight:499};
  await p.evaluate(() => window.__releaseWrites());
  await expect(p.getByTestId('download-status')).toHaveAttribute('data-status','current');
  result.freshness.afterAcknowledgement = await p.getByTestId('download-status').getAttribute('data-status');
  await p.keyboard.press('Control+s');
  result.freshness.actualHashes = await p.evaluate(async k => {
    const ws = JSON.parse(localStorage.getItem(k)).workspace; const d = ws.days['remy-2023-06-22'];
    const {currentExportArtifact, exportFreshness} = await import('/src/domain/exportReceipt.ts');
    return {receipt:d.exportReceipt.contentHash,current:currentExportArtifact(ws.animals.remy,d).hash,status:exportFreshness(ws.animals.remy,d).status};
  },key);
  await p.reload();
  result.freshness.persistedWeight = await p.getByLabel('Weight measured today (grams)').inputValue();
  await p.getByRole('button',{name:'Export',exact:true}).click();
  result.freshness.afterReload = await p.getByTestId('download-status').getAttribute('data-status');
  await c.close();
 } finally {await browser.close();console.log(JSON.stringify(result,null,2));fs.writeFileSync('/tmp/branch-rereview-export.json',JSON.stringify(result,null,2)+'\n');}
})().catch(err=>{console.error(err);process.exitCode=1;});
