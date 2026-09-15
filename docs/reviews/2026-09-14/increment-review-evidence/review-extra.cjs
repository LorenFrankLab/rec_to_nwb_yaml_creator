const {chromium,expect}=require(require('path').resolve(process.cwd(), 'node_modules/@playwright/test'));
const fs=require('fs');const base=process.env.REVIEW_BASE_URL || 'http://127.0.0.1:3012';
async function blank(c){const p=await c.newPage();await p.route('**/__review_blank__',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));await p.goto(base+'/__review_blank__');return p;}
(async()=>{const browser=await chromium.launch();const result={};try{
 let c=await browser.newContext();let p=await blank(c);
 const backup=await p.evaluate(async()=>{
  const {buildRealisticWorkspace}=await import('/src/__tests__/fixtures/workspaceBuilders.js');
  const {currentExportArtifact,buildExportReceipt}=await import('/src/domain/exportReceipt.ts');
  const {putBlob}=await import('/src/state/blobStore.ts');
  const {serializeWorkspaceBackup}=await import('/src/state/persistence.ts');
  const {animal,day}=buildRealisticWorkspace();const artifact=currentExportArtifact(animal,day);
  await putBlob('receipt:'+day.id,{filename:artifact.filename,yaml:artifact.yaml,exportedAt:'2026-09-14T00:00:00Z'});
  day.exportReceipt=buildExportReceipt({...artifact,now:'2026-09-14T00:00:00Z',schemaVersion:4,yamlStored:true});
  return serializeWorkspaceBackup({animals:{remy:animal},days:{[day.id]:day},settings:{}},'review');
 });await c.close();
 c=await browser.newContext();p=await blank(c);
 result.backupTransfer=await p.evaluate(async text=>{
  const {parseWorkspaceBackup}=await import('/src/state/persistence.ts');const {getBlob}=await import('/src/state/blobStore.ts');
  const parsed=parseWorkspaceBackup(text);const day=parsed.workspace.days['remy-2023-06-22'];
  return {yamlStoredFlag:day.exportReceipt.yamlStored,exactExportAvailable:!!await getBlob('receipt:'+day.id)};
 },backup);
 result.migratedValidation=await p.evaluate(async()=>{
  const {buildRealisticWorkspace}=await import('/src/__tests__/fixtures/workspaceBuilders.js');
  const {migrateDatedFactsV3ToV4}=await import('/src/state/datedFactsMigration.ts');
  const {mergeDayMetadata}=await import('/src/state/workspaceUtils.ts');const {validateDay}=await import('/src/domain/dayValidationComposer.ts');
  const {animal,day}=buildRealisticWorkspace();delete day.session.weight;day.state.validated=true;day.state.exported=false;
  const ws=migrateDatedFactsV3ToV4({animals:{remy:animal},days:{[day.id]:day},settings:{}});const d=ws.days[day.id];
  const issues=validateDay(d,mergeDayMetadata(ws.animals.remy,d),ws.animals.remy);
  return {weight:d.session.weight,errors:issues.filter(i=>i.severity==='error'),warnings:issues.filter(i=>i.code==='weight_from_baseline')};
 });await c.close();
 c=await browser.newContext();p=await blank(c);
 await p.evaluate(()=>{localStorage.setItem('rec_to_nwb_workspace_v1','UNREADABLE ORIGINAL');localStorage.setItem('rec_to_nwb_workspace_v1.meta',JSON.stringify({revision:9,writerId:'closed-previous-tab',savedAt:'2026-09-01T00:00:00Z'}));});
 await p.goto(base+'/#/workspace');await expect.poll(()=>p.evaluate(async()=> (await import('/src/state/writerLock.ts')).getWriterState().role)).toBe('writer');
 result.afterCorruption=await p.evaluate(async()=>{const {saveWorkspace,readPreservedBlob,WORKSPACE_QUARANTINE_KEY}=await import('/src/state/persistence.ts');const {createDefaultWorkspace}=await import('/src/state/workspaceUtils.ts');await readPreservedBlob(WORKSPACE_QUARANTINE_KEY);try {saveWorkspace(createDefaultWorkspace());return {saved:true};}catch(e){return {saved:false,error:e.message};}});await c.close();
 fs.writeFileSync('/tmp/rec-yaml-review-extra-evidence.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
