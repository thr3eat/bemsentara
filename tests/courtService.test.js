'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LAW_ARTICLES } = require('../bot/services/courtService');
const CourtCase = require('../models/CourtCase');

test('LAW_ARTICLES contains mandatory server law items', () => {
  assert.equal(LAW_ARTICLES['101'].code, 'Madde 101');
  assert.equal(LAW_ARTICLES['204'].code, 'Madde 204');
  assert.equal(LAW_ARTICLES['301'].code, 'Madde 301');
  assert.equal(LAW_ARTICLES['606'].code, 'Madde 606');
  assert.equal(LAW_ARTICLES['707'].code, 'Madde 707');
});

test('CourtCase model can create and update trial records', async () => {
  const caseCode = `TEST-${Date.now()}`;
  const cCase = await CourtCase.create({
    caseCode,
    plaintiffId: '111222333',
    defendantId: '444555666',
    lawArticle: 'Madde 101',
    reason: 'Spam yapma'
  });

  assert.equal(cCase.caseCode, caseCode);
  assert.equal(cCase.plaintiffId, '111222333');
  assert.equal(cCase.defendantId, '444555666');

  cCase.status = 'court_active';
  await cCase.save();

  const fetched = await CourtCase.findOne({ caseCode });
  assert.equal(fetched.status, 'court_active');
});
