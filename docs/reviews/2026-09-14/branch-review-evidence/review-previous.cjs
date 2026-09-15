const {chromium, expect} = require(require('path').resolve(process.cwd(), 'node_modules/@playwright/test'));
const fs = require('fs');
const base=process.env.REVIEW_BASE_URL || 'http://127.0.0.1:3013';
const key='rec_to_nwb_workspace_v1';
const result={};
async function blank(context) {
 const p=await context.newPage();
 await p.route('**/__review_blank__',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));
 await p.goto(base+'/__review_blank__');
 return p;
}
async function seed(p) {
 await p.evaluate(async()=>{
  const {buildRealisticWorkspace}=await import('/src/__tests__/fixtures/workspaceBuilders.js');
  const {createDefaultWorkspace}=await import('/src/state/workspaceUtils.ts');
  const {animal,day}=buildRealisticWorkspace();
  const ws=createDefaultWorkspace();ws.animals[animal.id]=animal;ws.days[day.id]=day;
  day.experimenters=structuredClone(animal.experimenters);day.optogenetics=null;
  localStorage.setItem('rec_to_nwb_workspace_v1',JSON.stringify({schemaVersion:4,workspace:ws}));
 });
}
async function role(p,r) {await expect.poll(()=>p.evaluate(async()=> (await import('/src/state/writerLock.ts')).getWriterState().role)).toBe(r);}
async function save(p) {await p.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true})));}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  let c=await browser.newContext();let a=await blank(c);await seed(a);await a.goto(base+'/#/day/remy-2023-06-22');await role(a,'writer');
  let b=await c.newPage();await b.goto(base+'/#/day/remy-2023-06-22');await role(b,'reader');
  const readerInput=b.locator('#day-team-names');
  result.readonly={disabled:await readerInput.isDisabled(),editable:await readerInput.isEditable()};
  await readerInput.fill('Reader entered observations');await save(b);
  result.readonly.readerValueBefore=await readerInput.inputValue();
  await a.locator('#day-team-names').fill('Writer saved observations');await save(a);
  await expect(readerInput).toHaveValue('Writer saved observations');
  result.readonly.readerValueAfterWriterSave=await readerInput.inputValue();
  result.readonly.storedValue=await b.evaluate(()=>JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1')).workspace.days['remy-2023-06-22'].experimenters.experimenter_name);
  await c.close();
  c=await browser.newContext();a=await blank(c);await seed(a);await a.goto(base+'/#/day/remy-2023-06-22');await role(a,'writer');
  b=await c.newPage();await b.goto(base+'/#/day/remy-2023-06-22');await role(b,'reader');
  await a.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='rec_to_nwb_workspace_v1')throw new DOMException('Quota full','QuotaExceededError');return original.call(this,k,v);};});
  await a.locator('#day-team-names').fill('Unsaved valuable observation');await save(a);
  await b.getByRole('button',{name:'Edit in this tab instead'}).click();await role(b,'writer');await role(a,'reader');
  await b.locator('#day-team-names').fill('New writer adds more data');await save(b);
  await expect(a.locator('#day-team-names')).toHaveValue('New writer adds more data');
  result.failedHandover={oldWriterValue:await a.locator('#day-team-names').inputValue(),newWriterValue:await b.locator('#day-team-names').inputValue()};
  await c.close();
  c=await browser.newContext();await c.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true}));
  a=await blank(c);await a.evaluate(()=>localStorage.setItem('rec_to_nwb_workspace_v1','ORIGINAL UNREADABLE SCIENTIFIC DATA'));
  await a.goto(base+'/#/workspace');await role(a,'writer');
  result.recovery={beforeReload:await a.evaluate(async()=>{const p=await import('/src/state/persistence.ts');return {main:localStorage.getItem(p.WORKSPACE_STORAGE_KEY),quarantine:await p.readPreservedBlob(p.WORKSPACE_QUARANTINE_KEY)};})};
  await a.reload();await role(a,'writer');
  result.recovery.afterReload=await a.evaluate(async()=>{const p=await import('/src/state/persistence.ts');return {main:localStorage.getItem(p.WORKSPACE_STORAGE_KEY),quarantine:await p.readPreservedBlob(p.WORKSPACE_QUARANTINE_KEY)};});
  await c.close();
  c=await browser.newContext();a=await blank(c);
  result.domain=await a.evaluate(async()=>{
   const {buildRealisticWorkspace}=await import('/src/__tests__/fixtures/workspaceBuilders.js');
   const {createDayRecord}=await import('/src/state/workspaceTransitions.ts');
   const {configurationChoiceStatus}=await import('/src/domain/configurationSelection.ts');
   const {deriveDataFolderForDate}=await import('/src/domain/dayCarryPolicy.ts');
   const {migrateDatedFactsV3ToV4}=await import('/src/state/datedFactsMigration.ts');
   const {mergeDayMetadata}=await import('/src/state/workspaceUtils.ts');
   const {provenanceReviewIssues}=await import('/src/domain/datedFactsValidation.ts');
   const {animal,day}=buildRealisticWorkspace();
   animal.configurationHistory=[{...animal.configurationHistory[0],date:'2023-06-01',version:1},{...animal.configurationHistory[0],date:'2023-07-01',version:2}];
   const dup=createDayRecord(animal,animal.id,'remy-2023-07-05','2023-07-05',{session_id:'x',session_description:'x'},'2026-09-14T00:00:00Z',{carryFrom:day,configurationVersion:1,configurationSource:'copied'});
   const back=createDayRecord(animal,animal.id,'remy-2023-06-25','2023-06-25',{session_id:'x',session_description:'x'},'2026-09-14T00:00:00Z');
   const raw=structuredClone(day);delete raw.session.weight;raw.state.validated=true;raw.state.exported=false;
   const migrated=migrateDatedFactsV3ToV4({animals:{remy:animal},days:{[raw.id]:raw},settings:{}}).days[raw.id];
   return {normalBackfillVersion:back.configurationVersion,duplicateVersion:dup.configurationVersion,duplicateStatus:configurationChoiceStatus(animal,dup),isoFolder:deriveDataFolderForDate('/data/remy/2023-06-22/','2023-06-22','2023-06-23'),baselineMigration:{weight:mergeDayMetadata(animal,migrated).subject.weight,review:provenanceReviewIssues(migrated)}};
  });
  await c.close();
  console.log(JSON.stringify(result,null,2));fs.writeFileSync('/tmp/branch-review-old-findings.json',JSON.stringify(result,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);console.error(JSON.stringify(result,null,2));process.exitCode=1;});
