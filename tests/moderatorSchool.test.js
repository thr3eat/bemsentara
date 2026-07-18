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
