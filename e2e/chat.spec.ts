import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Two real browsers, nothing mocked. If this fails, the real path is broken.
 */

/** Each participant needs its own context: the ID lives in sessionStorage. */
async function join(browser: Browser, displayName: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/');
  await page.getByLabel('Display name').fill(displayName);
  await page.getByRole('button', { name: 'Join the standup' }).click();
  await expect(page.getByRole('tablist')).toBeVisible();

  return page;
}

/** The composer shows a notice until every channel is open. */
async function waitForChannels(page: Page): Promise<void> {
  await expect(page.locator('form p')).toHaveCount(0, { timeout: 30_000 });
}

/** One row in the timeline, found by the text it shows. */
const messageItem = (page: Page, text: string) =>
  page.locator('li').filter({ hasText: text }).first();

test('two participants exchange, edit and delete messages over WebRTC', async ({ browser }) => {
  const alex = await join(browser, 'Alex Fisher');
  const bea = await join(browser, 'Bea Nolan');

  await test.step('both appear in presence', async () => {
    for (const page of [alex, bea]) {
      await expect(page.getByRole('tab', { name: /Participants/ })).toHaveText('Participants (2)');
    }

    await alex.getByRole('tab', { name: /Participants/ }).click();
    const roster = alex.getByRole('tabpanel');
    await expect(roster).toContainText('Alex Fisher');
    await expect(roster).toContainText('Bea Nolan');
    await alex.getByRole('tab', { name: /^Chat/ }).click();
  });

  await test.step('both data channels open', async () => {
    await waitForChannels(alex);
    await waitForChannels(bea);
  });

  await test.step('a message reaches the other participant', async () => {
    await alex.locator('form textarea').fill('Morning, standup in five.');
    await alex.locator('form textarea').press('Enter');

    await expect(messageItem(bea, 'Morning, standup in five.')).toBeVisible();
    /** The chat shows first names. The participant list shows full names. */
    await expect(messageItem(bea, 'Morning, standup in five.')).toContainText('Alex');
    await expect(alex.locator('form textarea')).toHaveValue('');
  });

  await test.step('an edit reaches the other participant', async () => {
    await messageItem(alex, 'Morning, standup in five.')
      .getByRole('button', { name: 'Edit' })
      .click();
    await alex.getByLabel('Edit message').fill('Morning, standup in ten.');
    await alex.getByRole('button', { name: 'Save' }).click();

    const edited = messageItem(bea, 'Morning, standup in ten.');
    await expect(edited).toBeVisible();
    await expect(edited).toContainText('(edited)');
  });

  await test.step('only the author can edit or delete', async () => {
    const theirs = messageItem(bea, 'Morning, standup in ten.');
    await expect(theirs.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(theirs.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  });

  await test.step('a deletion leaves a tombstone', async () => {
    await messageItem(alex, 'Morning, standup in ten.')
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect(messageItem(bea, 'Message deleted')).toBeVisible();
    await expect(bea.getByText('Morning, standup in ten.')).toHaveCount(0);
  });

  await test.step('closing a window removes that participant', async () => {
    await bea.context().close();

    await expect(alex.getByRole('tab', { name: /Participants/ })).toHaveText(
      'Participants (1)',
      { timeout: 20_000 },
    );
    /** Once, not twice. Building this notice inside a state updater
        announced it twice, because React may run an updater again. */
    await expect(alex.getByText('Bea left')).toHaveCount(1);
  });
});
