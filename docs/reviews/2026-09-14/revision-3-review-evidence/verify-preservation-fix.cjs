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
  const c = await browser.newContext(); const p = await blank(c);
  await p.evaluate(k=>localStorage.setItem(k,'{unreadable original'),key);
  await p.addInitScript(holdWriteAcknowledgements);
  await p.goto(base + '/#/workspace'); await role(p,'writer');
  await expect.poll(() => p.evaluate(() => window.__held.length)).toBeGreaterThan(0);
  await p.getByRole('button',{name:'Create Animal',exact:true}).first().click();
  await p.getByRole('textbox',{name:'Subject ID',exact:true}).fill('NewData');
  await p.getByLabel('Weight (grams)').fill('450');
  await p.getByLabel('Date of Birth').fill('2023-01-01');
  await p.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(p).toHaveURL(/animal\/NewData\/days/); await p.keyboard.press('Control+s');
  expect(await p.evaluate(k=>localStorage.getItem(k),key)).toBe('{unreadable original');
  result.pendingRecovery = {beforeAcknowledgement:await p.evaluate(k=>localStorage.getItem(k),key)};
  await p.evaluate(() => window.__releaseWrites());
  await expect.poll(() => p.evaluate(k=>{try{return Object.keys(JSON.parse(localStorage.getItem(k)).workspace.animals);}catch{return null;}},key)).toEqual(['NewData']);
  await p.reload();
  await expect(p.getByRole('heading',{name:'NewData',exact:true})).toBeVisible();
  result.pendingRecovery.animalSurvivesReload = true;
  await c.close();
 } finally {await browser.close();console.log(JSON.stringify(result,null,2));fs.writeFileSync('/tmp/revision3-preservation-fixed.json',JSON.stringify(result,null,2)+'\n');}
})().catch(err=>{console.error(err);process.exitCode=1;});
