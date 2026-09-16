const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const YAML=require('yaml');
const {chromium,expect}=require('@playwright/test');
const input=require('../workflow-review-evidence/synthetic-inputs.json')[0];
const origin='http://127.0.0.1:3018';
const findings=[];
(async()=>{
 const browser=await chromium.launch();
 try {
  for(const reloadBeforeEdit of [false,true]) {
   const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
   const page=await context.newPage();
   page.setDefaultTimeout(10000);
   const tag=reloadBeforeEdit?'reload-first':'immediate';
   async function read() {
    await page.keyboard.press('Control+s');
    return page.evaluate(async()=>{
     const {mergeDayMetadata}=await import('/src/state/workspaceUtils.ts');
     const {validateDay}=await import('/src/domain/dayValidationComposer.ts');
     const workspace=JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1')).workspace;
     const day=workspace.days['remy-2023-06-22'];const animal=workspace.animals.remy;
     const merged=mergeDayMetadata(animal,day);
     return {animalTaskTypes:animal.taskTypes??null,day,mergedTasks:merged.tasks,issues:validateDay(day,merged,animal,Object.values(workspace.days))};
    });
   }
   async function capture(name) {
    await page.evaluate(async()=>{await document.fonts.ready;for(const a of document.getAnimations()){try{a.finish()}catch{}}});
    await page.screenshot({path:path.join(__dirname,`${tag}-${name}.png`),fullPage:true});
    fs.writeFileSync(path.join(__dirname,`${tag}-${name}.txt`),await page.locator('body').innerText());
   }
   await page.goto(`${origin}/#/import`);
   await page.getByLabel(/Choose a metadata YAML file/i).setInputFiles({name:input.sourceName,mimeType:'application/yaml',buffer:Buffer.from(YAML.stringify(input.flatModel))});
   await page.getByRole('button',{name:'Import as new animal',exact:true}).click();
   await expect(page.getByRole('region',{name:'Import complete',exact:true})).toBeVisible();
   await expect.poll(()=>page.evaluate(()=>!!JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1')||'{}').workspace?.days?.['remy-2023-06-22'])).toBe(true);
   await page.goto(`${origin}/#/day/remy-2023-06-22`);
   if(reloadBeforeEdit)await page.reload();
   await page.getByRole('button',{name:'Show epoch 2 details',exact:true}).click();
   const before=await read();
   assert.equal(before.mergedTasks.length,3);
   await page.getByRole('button',{name:'Edit for this day',exact:true}).click();
   await page.getByLabel('Environment for this day',{exact:true}).fill('New room for this day');
   await capture('before-save');
   await page.getByRole('button',{name:'Save for this day',exact:true}).click();
   const after=await read();
   assert.equal(after.mergedTasks.length,0);
   assert.equal(after.animalTaskTypes,null);
   assert(after.issues.some(i=>i.code==='dangling_task_type_ref'));
   await capture('after-save');
   await page.reload();
   await expect(page.getByRole('navigation',{name:'Day editor sections'})).toBeVisible();
   const afterReload=await read();
   assert.equal(afterReload.mergedTasks.length,0);
   await page.getByRole('navigation',{name:'Day editor sections'}).getByRole('button',{name:/Fix.*Export/}).click();
   await expect(page.getByRole('button',{name:'Download',exact:true})).toBeDisabled();
   await capture('export-blocked');
   findings.push({reloadBeforeEdit,before,after,afterReload,downloadDisabled:true});
   await context.close();
  }
 }finally{
  fs.writeFileSync(path.join(__dirname,'import-first-edit.json'),JSON.stringify(findings,null,2));
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
