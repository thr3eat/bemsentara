'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getProgressBar } = require('../bot/services/staffSystem');

test('getProgressBar generates formatted progress bar string', () => {
  const bar0 = getProgressBar(0);
  assert.equal(bar0, '`[░░░░░░░░░░]` **%0**');

  const bar50 = getProgressBar(50);
  assert.equal(bar50, '`[█████░░░░░]` **%50**');

  const bar100 = getProgressBar(100);
  assert.equal(bar100, '`[██████████]` **%100**');
});

test('generateBriefingSettingsEmbed and getBriefingSettingsComponents return proper embeds and buttons', () => {
  const { generateBriefingSettingsEmbed, getBriefingSettingsComponents } = require('../bot/services/staffSystem');
  const fakeProgress = { briefingSettings: { enabledSections: { greeting: true }, order: ['greeting'] } };

  const embed = generateBriefingSettingsEmbed(fakeProgress);
  assert.ok(embed);
  assert.match(embed.data.title, /BRİFİNG AYARLARI/);

  const components = getBriefingSettingsComponents(fakeProgress);
  assert.equal(components.length, 3);
});

test('generateTutorialEmbed and getTutorialComponents support 3 steps', () => {
  const { generateTutorialEmbed, getTutorialComponents } = require('../bot/services/staffSystem');
  const step1 = generateTutorialEmbed(1);
  assert.match(step1.data.title, /1\/3/);

  const comp1 = getTutorialComponents(1);
  assert.ok(comp1.length > 0);
});

