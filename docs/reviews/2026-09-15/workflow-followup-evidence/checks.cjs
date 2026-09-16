const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const YAML = require('yaml');
const { chromium, expect } = require('@playwright/test');
const seed = require('../workflow-review-evidence/seed.json');
const inputs = require('../workflow-review-evidence/synthetic-inputs.json');
const origin = 'http://127.0.0.1:3018';
const results = {};

(async () => {
  const browser = await chromium.launch();
  try {
    async function fresh(edit) {
      const context = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await page.goto(`${origin}/#/workspace`);
      if (edit !== false) {
        const data = structuredClone(seed.workspace);
        if (edit) edit(data.animals[seed.animalId],data.days[seed.dayId]);
        await page.evaluate(workspace => localStorage.setItem('rec_to_nwb_workspace_v1',JSON.stringify({schemaVersion:4,workspace})),data);
        await page.reload();
      }
      return {context,page};
    }
    async function workspace(page) {
      await page.keyboard.press('Control+s');
      return page.evaluate(() => JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1') || '{"workspace":{"animals":{},"days":{}}}').workspace);
    }
    async function effective(page,dayId=seed.dayId) {
      await workspace(page);
      return page.evaluate(async dayId => {
        const {mergeDayMetadata}=await import('/src/state/workspaceUtils.ts');
        const workspace=JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1')).workspace;
        const day=workspace.days[dayId];
        return mergeDayMetadata(workspace.animals[day.animalId],day);
      },dayId);
    }
    async function capture(page,name) {
      await page.evaluate(async()=>{await document.fonts.ready;for(const a of document.getAnimations()){try{a.finish()}catch{}}});
      await page.screenshot({path:path.join(__dirname,`${name}.png`),fullPage:true});
      fs.writeFileSync(path.join(__dirname,`${name}.txt`),await page.locator('body').innerText());
    }
    async function editRoom(page,room) {
      await page.getByRole('button',{name:'Show epoch 2 details',exact:true}).click();
      await page.getByRole('button',{name:'Edit for this day',exact:true}).click();
      await page.getByLabel('Environment for this day',{exact:true}).fill(room);
      await page.getByRole('button',{name:'Save for this day',exact:true}).click();
      const close = page.getByRole('button',{name:'Close epoch 2 details',exact:true});
      // The detail panel can disappear on save; inspect persisted state independently of the panel.
      if (await close.isVisible()) await close.click();
    }
    {
      const {page,context}=await fresh();
      await page.goto(`${origin}/#/animal/${seed.animalId}/task-types`);
      await page.getByRole('button',{name:'Edit task type sleep',exact:true}).click();
      await page.getByLabel('Environment',{exact:true}).fill('Room B');
      await page.getByRole('checkbox',{name:/side_camera/}).check();
      await page.getByRole('button',{name:'Save task type',exact:true}).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button',{name:'Cancel',exact:true}).click();
      await expect(page.getByLabel('Environment',{exact:true})).toHaveValue('Room B');
      await page.getByRole('button',{name:'Save task type',exact:true}).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await capture(page,'01-repeated-save-asks-scope');
      await page.getByRole('alertdialog').getByRole('button',{name:'Cancel',exact:true}).click();
      await page.getByLabel('Environment',{exact:true}).fill('Room C');
      await page.getByRole('button',{name:'Save task type',exact:true}).click();
      await page.getByRole('button',{name:'Keep earlier days as recorded (recommended)',exact:true}).click();
      const ws=await workspace(page);
      const merged=await effective(page);
      const historical=merged.tasks.filter(t=>t.task_name==='sleep');
      assert(historical.every(t=>t.task_environment==='home cage'));
      for(const task of historical)assert.deepEqual(task.camera_id,[0]);
      assert.equal(ws.animals.remy.taskTypes[0].task_environment,'Room C');
      assert.deepEqual(ws.animals.remy.taskTypes[0].camera_id,[0,1]);
      results.R1={repeatedSaveAsked:true,default:ws.animals.remy.taskTypes[0],historical};
      await context.close();
    }
    {
      const {page,context}=await fresh((animal,day)=>{
        animal.taskTypes[1].camera_id=[1,0];
        day.associated_files.push(
          {name:'statescript_epoch2',description:'Log for epoch 2',path:'/data/remy/20230622/e2.stateScriptLog',task_epochs:2},
          {name:'statescript_epoch4',description:'Log for epoch 4',path:'/data/remy/20230622/e4.stateScriptLog',task_epochs:4}
        );
      });
      await page.goto(`${origin}/#/day/${seed.dayId}`);
      await editRoom(page,'Second room');
      const merged=await effective(page);
      assert.deepEqual(merged.tasks.find(t=>t.task_name==='w_alternation').camera_id,[1,0]);
      results.R2={cameraIds:merged.tasks.find(t=>t.task_name==='w_alternation').camera_id};
      await page.getByRole('navigation',{name:'Day editor sections'}).getByRole('button',{name:/Fix.*Export/}).click();
      await expect(page.getByText(/Ready to export\s*·\s*2 warnings to review/)).toBeVisible();
      const review=page.getByRole('group',{name:'Effective setup for this day'});
      await expect(review.getByText('2 warnings to review (does not block export)',{exact:true})).toBeVisible();
      await capture(page,'02-day-warning-counts-agree');
      await page.goto(`${origin}/#/animal/${seed.animalId}/export`);
      await page.getByTestId(`effective-${seed.dayId}`).locator('summary').click();
      await expect(page.getByText('2 warnings to review (does not block export)',{exact:true})).toBeVisible();
      await capture(page,'03-animal-warning-counts-agree');
      results.R5={dayWarnings:2,animalReviewWarnings:2};
      await context.close();
    }
    {
      const {page,context}=await fresh(false);
      async function upload(list) {
        await page.getByLabel(/Choose a metadata YAML file/i).setInputFiles(list.map(i=>({name:i.sourceName,mimeType:'application/yaml',buffer:Buffer.from(YAML.stringify(i.flatModel))})));
      }
      function dated(digits,mpp) {
        const next=structuredClone(inputs[1]);
        next.sourceName=`${digits}_remy_metadata.yml`;
        next.flatModel.session_id=`remy_${digits}`;
        next.flatModel.cameras[0].meters_per_pixel=mpp;
        return next;
      }
      await page.goto(`${origin}/#/import`);
      await upload(inputs);
      await page.getByRole('button',{name:'Review 2 ready files',exact:true}).click();
      await page.getByRole('button',{name:'Confirm import',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Import complete',exact:true})).toBeVisible();
      await expect.poll(async()=>Object.keys((await workspace(page)).days).length).toBe(2);
      await page.getByRole('button',{name:'Import more files',exact:true}).click();
      await upload([dated('20230624',0.003)]);
      await expect(page.getByRole('button',{name:'Add recording day',exact:true})).toBeEnabled();
      await expect(page.getByLabel(/Map camera/)).toHaveCount(0);
      await page.getByRole('button',{name:'Add recording day',exact:true}).click();
      await expect(page.getByRole('radio',{name:/Keep as separate cameras/})).toBeChecked();
      await capture(page,'04-incremental-calibration-choice');
      await page.getByRole('button',{name:'Confirm import',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Import complete',exact:true})).toBeVisible();
      await expect.poll(async()=>Object.keys((await workspace(page)).days).length).toBe(3);
      const before=await workspace(page);
      await page.getByRole('button',{name:'Import more files',exact:true}).click();
      await upload([dated('20230625',0.002)]);
      await expect(page.getByRole('button',{name:'Add recording day',exact:true})).toBeEnabled();
      await expect(page.getByLabel(/Map camera/)).toHaveCount(0);
      await page.getByRole('button',{name:'Add recording day',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Recording day added',exact:true})).toBeVisible();
      await expect.poll(async()=>Object.keys((await workspace(page)).days).length).toBe(4);
      const ws=await workspace(page);
      assert.deepEqual(ws.animals.remy.cameras,before.animals.remy.cameras);
      const imported=await effective(page,'remy-2023-06-25');
      const run=imported.tasks.find(t=>t.task_name==='w_alternation');
      assert.deepEqual(run.camera_id,[2,1]);
      await capture(page,'05-known-calibration-new-day');
      await page.getByRole('button',{name:'Import more files',exact:true}).click();
      await upload([inputs[1]]);
      await expect(page.getByRole('button',{name:'Add recording day',exact:true})).toBeEnabled();
      await expect(page.getByLabel(/Map camera/)).toHaveCount(0);
      await page.getByRole('button',{name:'Add recording day',exact:true}).click();
      await expect(page.getByRole('alert').filter({hasText:/already exists/})).toBeVisible();
      assert.deepEqual((await workspace(page)).animals.remy.cameras,before.animals.remy.cameras);
      await capture(page,'06-repeat-import-duplicate-day');
      results.R3={calibrations:ws.animals.remy.cameras,dayCount:4,recognizedNewDayTask:run,duplicateDayRejectedWithoutMapping:true};
      await page.goto(`${origin}/#/day/remy-2023-06-25`);
      await editRoom(page,'Room after split import');
      const edited=await effective(page,'remy-2023-06-25');
      const editedRun=edited.tasks.find(t=>t.task_name==='w_alternation');
      results.integrationDebug={before:imported,after:edited,workspace:await workspace(page)};
      await capture(page,'07-split-camera-order-after-room-edit');
      assert.equal(edited.tasks.length,imported.tasks.length,'A first context edit must preserve the imported tasks');
      assert.deepEqual(editedRun.camera_id,[2,1]);
      assert.equal(edited.cameras.find(c=>c.id===editedRun.camera_id[0]).meters_per_pixel,0.002);
      results.R3.afterRoomEdit=editedRun;
      await context.close();
    }
  } finally {
    fs.writeFileSync(path.join(__dirname,'checks.json'),JSON.stringify(results,null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
