const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldEscalateSchoolKick } = require('../bot/services/moderatorSchool');

test('shouldEscalateSchoolKick returns true for inactive students with warnings and AI recommendation', () => {
  const result = shouldEscalateSchoolKick({
    daysInactive: 3,
    warningCount: 1,
    aiRecommendation: 'EVET, ATILSIN'
  });

  assert.equal(result, true);
});

test('shouldEscalateSchoolKick returns false when the AI recommendation says keep the student', () => {
  const result = shouldEscalateSchoolKick({
    daysInactive: 3,
    warningCount: 1,
    aiRecommendation: 'HAYIR, ATILMASIN'
  });

  assert.equal(result, false);
});

test('moderatorSchool exports religion oath functions', () => {
  const { sendReligionOathEmbed, handleReligionOathModalSubmit, completeModSchoolTransfer } = require('../bot/services/moderatorSchool');
  assert.equal(typeof sendReligionOathEmbed, 'function');
  assert.equal(typeof handleReligionOathModalSubmit, 'function');
  assert.equal(typeof completeModSchoolTransfer, 'function');
});

test('handleSchoolButtons opens modals for school_rel_custom and school_rel_paste_btn without reference errors', async () => {
  const { handleSchoolButtons } = require('../bot/services/moderatorSchool');

  let shownModal = null;
  const mockInteractionCustom = {
    customId: 'school_rel_custom',
    user: { id: '123' },
    showModal: (modal) => { shownModal = modal; return Promise.resolve(); }
  };

  await handleSchoolButtons(mockInteractionCustom, {});
  assert.ok(shownModal);
  assert.equal(shownModal.data.custom_id, 'school_rel_custom_modal');

  shownModal = null;
  const mockInteractionPaste = {
    customId: 'school_rel_paste_btn',
    user: { id: '123' },
    showModal: (modal) => { shownModal = modal; return Promise.resolve(); }
  };

  await handleSchoolButtons(mockInteractionPaste, {});
  assert.ok(shownModal);
  assert.equal(shownModal.data.custom_id, 'school_rel_oath_modal');
});


