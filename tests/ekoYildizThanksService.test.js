'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  THANKS_CHANNEL_ID,
  THANKS_GUILD_ID,
  setupEkoYildizThanksPanel,
  handleThanksTriggerButton
} = require('../bot/services/ekoYildizThanksService');

test('ekoYildizThanksService exports correct channel and guild constants', () => {
  assert.equal(THANKS_CHANNEL_ID, '1521849640394428538');
  assert.equal(THANKS_GUILD_ID, '1483482948320891074');
});

test('handleThanksTriggerButton returns a modal with ekoyildiz_thanks_modal customId', async () => {
  let modalShown = null;
  const fakeInteraction = {
    showModal: (modal) => {
      modalShown = modal;
      return Promise.resolve();
    }
  };

  await handleThanksTriggerButton(fakeInteraction);
  assert.ok(modalShown);
  assert.equal(modalShown.data.custom_id, 'ekoyildiz_thanks_modal');
});
