const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const seed = require('../workflow-review-evidence/seed.json');
const results = {};
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const production = 'http://127.0.0.1:3019/rec_to_nwb_yaml_creator';
    async function shell() {
      return page.evaluate(() => {
        const skip = document.querySelector('.skip-link');
        const footer = document.querySelector('.footer a');
        const nav = document.querySelector('.primary-nav');
        return {
          skip: { position: getComputedStyle(skip).position, left: getComputedStyle(skip).left },
          footer: { display: getComputedStyle(footer).display, height: footer.getBoundingClientRect().height, minHeight: getComputedStyle(footer).minHeight },
          nav: nav?.getBoundingClientRect().toJSON(),
          stylesheets: [...document.querySelectorAll('link[rel=stylesheet]')].map(e => e.href),
          scripts: performance.getEntriesByType('resource').filter(e => e.name.endsWith('.js')).map(e => ({ name:e.name.split('/').pop(), bytes:e.decodedBodySize }))
        };
      });
    }
    await page.goto(`${production}/#/workspace`);
    await expect(page.getByRole('button', { name: 'Create Animal', exact: true })).toBeVisible();
    results.coldWorkspace = await shell();
    await page.screenshot({ path: path.join(__dirname, '30-production-cold-workspace.png'), fullPage:true });
    await page.goto(`${production}/#/`);
    await expect(page.locator('#main-content')).toBeVisible();
    await expect.poll(() => page.locator('.skip-link').first().evaluate(e => getComputedStyle(e).position)).toBe('absolute');
    await page.goto(`${production}/#/workspace`);
    await expect(page.getByRole('button', { name: 'Create Animal', exact: true })).toBeVisible();
    results.workspaceAfterLegacy = await shell();
    await page.screenshot({ path: path.join(__dirname, '31-production-workspace-after-legacy.png'), fullPage:true });

    const dev = 'http://127.0.0.1:3018';
    await page.goto(`${dev}/#/home`);
    await page.getByRole('textbox', { name: 'Subject ID', exact: true }).fill('ReviewDraft');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1') || '{}').workspace?.animals?.ReviewDraft?.subject)).toBeTruthy();
    results.blankFactsDraft = await page.evaluate(() => JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1')).workspace.animals.ReviewDraft.subject);
    await page.evaluate(workspace => localStorage.setItem('rec_to_nwb_workspace_v1', JSON.stringify({ schemaVersion:4,workspace })), seed.workspace);
    await page.reload();
    await page.goto(`${dev}/#/copy-from-animal`);
    await page.getByLabel('Source animal').selectOption(seed.animalId);
    await page.getByLabel('Subject ID *', { exact:true }).fill('Review_Rat');
    results.invalidCopiedId = { disabled: await page.getByRole('button', { name:'Copy & continue setup →',exact:true }).isDisabled(),text:await page.locator('body').innerText() };
    await page.getByLabel('Subject ID *', { exact:true }).fill('ReviewCase');
    await page.getByRole('button', { name:'Copy & continue setup →',exact:true }).click();
    await expect(page.getByRole('textbox', { name:'Subject ID',exact:true })).toHaveValue('ReviewCase');
    results.copiedCase = await page.getByRole('textbox', { name:'Subject ID',exact:true }).inputValue();
    await page.goto(`${dev}/#/day/${seed.dayId}`);
    const nav = page.getByRole('navigation',{name:'Day editor sections'});
    await nav.getByRole('button').first().focus();
    results.tabOrder = [];
    for (let i=0; i<5; i++) {
      results.tabOrder.push(await page.evaluate(() => document.activeElement.getAttribute('aria-label')));
      await page.keyboard.press('Tab');
    }
    await page.goto(`${dev}/#/animal/${seed.animalId}/task-types`);
    await page.getByRole('button',{name:'Edit task type sleep',exact:true}).click();
    await page.getByLabel('Environment',{exact:true}).fill('New default');
    await page.getByRole('button',{name:'Save task type',exact:true}).click();
    await page.getByRole('button',{name:'Keep earlier days as recorded (recommended)',exact:true}).click();
    await page.keyboard.press('Control+s');
    results.keepHistory = await page.evaluate(async dayId => {
      const {mergeDayMetadata} = await import('/src/state/workspaceUtils.ts');
      const workspace = JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1')).workspace;
      const day = workspace.days[dayId]; const animal = workspace.animals[day.animalId];
      return { default:animal.taskTypes[0].task_environment, historical:mergeDayMetadata(animal,day).tasks.filter(t=>t.task_name==='sleep') };
    }, seed.dayId);
  } finally {
    fs.writeFileSync(path.join(__dirname,'shell-and-forms.json'),JSON.stringify(results,null,2));
    await browser.close();
  }
})().catch(error => { console.error(error);process.exitCode=1; });
