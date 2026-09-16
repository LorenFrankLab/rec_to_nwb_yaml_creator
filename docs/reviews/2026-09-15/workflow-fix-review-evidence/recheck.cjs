const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const seed = require('../workflow-review-evidence/seed.json');
const origin = 'http://127.0.0.1:3018';
const results = {};

(async () => {
  const browser = await chromium.launch();
  try {
    async function seeded(edit) {
      const data = structuredClone(seed);
      if (edit) edit(data.workspace.animals[data.animalId], data.workspace.days[data.dayId]);
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto(`${origin}/#/workspace`);
      await page.evaluate(workspace => localStorage.setItem('rec_to_nwb_workspace_v1', JSON.stringify({ schemaVersion: 4, workspace })), data.workspace);
      await page.reload();
      return { context, page, data };
    }
    async function merged(page) {
      await page.keyboard.press('Control+s');
      return page.evaluate(async dayId => {
        const { mergeDayMetadata } = await import('/src/state/workspaceUtils.ts');
        const workspace = JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1')).workspace;
        const day = workspace.days[dayId];
        return { tasks: mergeDayMetadata(workspace.animals[day.animalId], day).tasks, instances: day.taskInstances };
      }, seed.dayId);
    }
    async function capture(page, name) {
      await page.evaluate(async () => { await document.fonts.ready; for (const animation of document.getAnimations()) { try { animation.finish(); } catch {} } });
      await page.screenshot({ path: path.join(__dirname, `${name}.png`), fullPage: true });
      fs.writeFileSync(path.join(__dirname, `${name}.txt`), await page.locator('body').innerText());
    }
    {
      const { page, context } = await seeded();
      await page.goto(`${origin}/#/animal/${seed.animalId}/task-types`);
      const before = await merged(page);
      await page.getByRole('button', { name: 'Edit task type sleep', exact: true }).click();
      await page.getByLabel('Environment', { exact: true }).fill('Room B');
      await page.getByRole('button', { name: 'Save task type', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await capture(page, '01-task-scope-before-cancel');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.getByLabel('Environment', { exact: true })).toHaveValue('Room B');
      await page.getByRole('button', { name: 'Save task type', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      const after = await merged(page);
      results.cancelScope = { before, after, dialogAfterSecondSave: false };
      await capture(page, '02-task-scope-second-save');
      await context.close();
    }
    {
      const { page, context } = await seeded((animal, day) => {
        animal.taskTypes[1].camera_id = [1, 0];
        day.associated_files.push(
          { name: 'statescript_epoch2', description: 'Log for epoch 2', path: '/data/remy/20230622/e2.stateScriptLog', task_epochs: 2 },
          { name: 'statescript_epoch4', description: 'Log for epoch 4', path: '/data/remy/20230622/e4.stateScriptLog', task_epochs: 4 }
        );
      });
      await page.goto(`${origin}/#/day/${seed.dayId}`);
      await page.getByRole('navigation', { name: 'Day editor sections' }).getByRole('button', { name: /Daily log/ }).click();
      const before = await merged(page);
      fs.writeFileSync(path.join(__dirname, 'epoch-buttons.json'), JSON.stringify(await page.getByRole('button').evaluateAll(nodes => nodes.map(n => ({ text:n.textContent, label:n.getAttribute('aria-label') }))), null, 2));
      await page.getByRole('button', { name: 'Show epoch 2 details', exact: true }).click();
      await page.getByRole('button', { name: 'Edit for this day', exact: true }).click();
      await page.getByLabel('Environment for this day', { exact: true }).fill('Second room');
      await capture(page, '03-day-context-before-save');
      await page.getByRole('button', { name: 'Save for this day', exact: true }).click();
      const after = await merged(page);
      results.cameraOrder = { before, after };
      await capture(page, '04-day-context-after-save');
      await page.getByRole('button', { name: 'Close epoch 2 details', exact: true }).click();
      await page.getByRole('navigation', { name: 'Day editor sections' }).getByRole('button', { name: /Fix.*Export/ }).click();
      await capture(page, '05-export-review');
      results.exportAxe = (await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations;
      await context.close();
    }
  } finally {
    fs.writeFileSync(path.join(__dirname, 'recheck.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
