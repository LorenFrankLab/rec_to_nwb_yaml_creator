const fs=require('node:fs'); const path=require('node:path'); const YAML=require('yaml'); const {chromium}=require('playwright');
const out=__dirname;
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):/\.ya?ml$/i.test(e.name)?[path.join(p,e.name)]:[]);}
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage();
  await page.route('**/__audit__',r=>r.fulfill({contentType:'text/html',body:'<html><body>Read-only domain audit</body></html>'}));
  await page.goto('http://127.0.0.1:3017/__audit__');
  const rawFiles=walk('/Users/edeno/Downloads/all_rat_metadata_yaml').map(file=>({sourceName:path.basename(file),file,text:fs.readFileSync(file,'utf8')}));
  const survey=[];
  for(let i=0;i<rawFiles.length;i+=20){
   survey.push(...await page.evaluate(async files=>{
    const {decodeYaml}=await import('/src/io/yaml.ts');
    const {buildImportRepairPlan}=await import('/src/state/importRepair.ts');
    const {planImport}=await import('/src/state/yamlImportPlan.ts');
    return files.map(({file,sourceName,text})=>{
     try{const model=decodeYaml(text);const repair=buildImportRepairPlan(model,sourceName,{animals:{}}); const plan=planImport([{sourceName,flatModel:model}],{animals:{}});
      return {file,sourceName,decision:repair.decision,items:repair.items.map(i=>({path:i.path,code:i.code,kind:i.kind})),blockers:repair.blockers,benign:repair.benign,acceptedWithoutRepairs:plan.animals.length>0,unimportable:plan.unimportable};
     }catch(e){return{file,error:String(e)}}
    });
   },rawFiles.slice(i,i+20)));
  }
  fs.writeFileSync(path.join(out,'import-survey.json'),JSON.stringify(survey,null,2));
  const summary={total:survey.length,parseOrAuditErrors:survey.filter(r=>r.error).length,readyWithoutResponses:survey.filter(r=>!r.error&&!r.items.length&&!r.blockers.length&&r.acceptedWithoutRepairs).length,requiringSourceEdits:survey.filter(r=>r.blockers?.length).length,requiringAnswers:survey.filter(r=>r.items?.length).length,blockerCodes:{},repairCodes:{}};
  for(const r of survey){for(const b of r.blockers||[])summary.blockerCodes[b.code]=(summary.blockerCodes[b.code]||0)+1;for(const b of r.items||[])summary.repairCodes[b.code]=(summary.repairCodes[b.code]||0)+1;}
  fs.writeFileSync(path.join(out,'import-survey-summary.json'),JSON.stringify(summary,null,2)); console.log('Import survey',summary);
  const repro=await page.evaluate(async()=>{
   const {buildCatalogWorkspace}=await import('/src/__tests__/fixtures/workspaceBuilders.js');
   const {createDefaultWorkspace,mergeDayMetadata}=await import('/src/state/workspaceUtils.ts');
   const {createWorkspaceActions}=await import('/src/state/workspaceActions.ts');
   const {planImport}=await import('/src/state/yamlImportPlan.ts');
   const {applyImportPlan}=await import('/src/state/yamlImportApply.ts');
   const {validateDay}=await import('/src/domain/dayValidationComposer.ts');
   const {animal,day}=buildCatalogWorkspace();
   const first=mergeDayMetadata(animal,day), second=structuredClone(first);
   first.cameras[0].meters_per_pixel=0.001;
   second.cameras[0].meters_per_pixel=0.002;
   second.session_id='remy_20230623';
   const inputs=[{sourceName:'20230622_remy_metadata.yml',flatModel:first},{sourceName:'20230623_remy_metadata.yml',flatModel:second}];
   const plan=planImport(inputs,{animals:{}});
   let ws=createDefaultWorkspace();const ref={current:ws};const commit=fn=>{ref.current=fn(ref.current)};
   const actions=createWorkspaceActions({commitWorkspace:commit,setWorkspace:commit,workspaceRef:ref});
   const applied=applyImportPlan(plan,actions,{workspace:ref.current});
   const exported=Object.values(ref.current.days).map(d=>{const a=ref.current.animals[d.animalId],merged=mergeDayMetadata(a,d);return {date:d.date,cameras:merged.cameras,issues:validateDay(d,merged,a,Object.values(ref.current.days))}});
   const ws2=createDefaultWorkspace();ws2.animals[animal.id]=animal; ws2.days[day.id]=day;
   const before=mergeDayMetadata(animal,day).tasks;
   const changed=structuredClone(animal); changed.taskTypes[0].task_environment='Different room on the later date';
   const after=mergeDayMetadata(changed,day).tasks;
   return {cameraImport:{inputs,plan,applied,exported},taskEnvironment:{before,after}};
  });
  fs.writeFileSync(path.join(out,'domain-findings.json'),JSON.stringify(repro,null,2));
  fs.writeFileSync(path.join(out,'synthetic-inputs.json'),JSON.stringify(repro.cameraImport.inputs));
  console.log('Camera import',repro.cameraImport.applied,repro.cameraImport.exported.map(d=>({date:d.date,mpp:d.cameras[0]?.meters_per_pixel})));
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
