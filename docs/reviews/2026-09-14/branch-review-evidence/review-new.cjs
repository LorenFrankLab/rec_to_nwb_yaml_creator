const {chromium,expect}=require(require('path').resolve(process.cwd(),'node_modules/@playwright/test'));
const fs=require('fs');const base=process.env.REVIEW_BASE_URL || 'http://127.0.0.1:3013';
async function blank(c){const p=await c.newPage();await p.route('**/__branch_blank__',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));await p.goto(base+'/__branch_blank__');return p;}
(async()=>{const browser=await chromium.launch();try{
 const context=await browser.newContext();const p=await blank(context);
 const result=await p.evaluate(async()=>{
  const {buildRealisticWorkspace}=await import('/src/__tests__/fixtures/workspaceBuilders.js');
  const {createDefaultWorkspace,mergeDayMetadata}=await import('/src/state/workspaceUtils.ts');
  const {createWorkspaceActions}=await import('/src/state/workspaceActions.ts');
  const {createDayRecord,reseedDayFromSource}=await import('/src/state/workspaceTransitions.ts');
  const {configurationChoiceIssues}=await import('/src/domain/datedFactsValidation.ts');
  const {configurationChoiceStatus}=await import('/src/domain/configurationSelection.ts');
  const {findAnimalIdByLookup}=await import('/src/domain/animalCreation.ts');
  const {buildEpochGrid}=await import('/src/viewModels/epochGridViewModel.ts');
  const {animal,day}=buildRealisticWorkspace();animal.configurationHistory[0].date='2023-06-01';
  const ws=createDefaultWorkspace();ws.animals.remy=animal;ws.days[day.id]=day;
  const ref={current:ws};const commit=fn=>{ref.current=fn(ref.current);};
  const actions=createWorkspaceActions({commitWorkspace:commit,setWorkspace:commit,workspaceRef:ref});
  actions.createDay('remy','2023-06-25',{session_id:'remy_20230625',session_description:'known recording'});
  const before=configurationChoiceStatus(ref.current.animals.remy,ref.current.days['remy-2023-06-25']);
  actions.setConfigurationEffectiveDate('remy',1,'2023-07-01');
  const after=configurationChoiceStatus(ref.current.animals.remy,ref.current.days['remy-2023-06-25']);
  const dateIssues=configurationChoiceIssues(ref.current.days['remy-2023-06-25'],ref.current.animals.remy);
  const source=structuredClone(day);source.session.experiment_description='SOURCE protocol';
  const target=createDayRecord(animal,'remy','remy-2023-06-23','2023-06-23',{session_id:'remy_20230623',session_description:'Target day observations',experiment_description:'TARGET recorded protocol',weight:490},'2026-09-14T00:00:00Z');
  const reseeded=reseedDayFromSource(animal,target,source,'2026-09-14T00:00:01Z');
  actions.updateAnimal('remy',{subject:{subject_id:'OtherRat'}});
  const lookup=findAnimalIdByLookup('OtherRat',ref.current.animals);
  const historicalOpto=structuredClone(day);historicalOpto.optogenetics={opto_excitation_source:[{name:'laser'}]};
  const disabledDefault={...animal,optogenetics:null};
  const plainDay={...day,optogenetics:null};const enabledDefault={...animal,optogenetics:historicalOpto.optogenetics};
  return {effectiveDate:{before,after,issues:dateIssues},sourceChange:{descriptionBefore:target.session.experiment_description,descriptionAfter:reseeded.session.experiment_description},identityLookup:{lookup,exportSubject:ref.current.animals.remy.subject.subject_id,workspaceKey:'remy'},opto:{historicalGridEnabled:buildEpochGrid(disabledDefault,historicalOpto).isOpto,historicalExportSources:mergeDayMetadata(disabledDefault,historicalOpto).opto_excitation_source.length,plainGridEnabled:buildEpochGrid(enabledDefault,plainDay).isOpto,plainExportSources:mergeDayMetadata(enabledDefault,plainDay).opto_excitation_source.length}};
 });
 console.log(JSON.stringify(result,null,2));fs.writeFileSync('/tmp/branch-review-new-evidence.json',JSON.stringify(result,null,2));
 await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
