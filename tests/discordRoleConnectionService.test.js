const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRoleConnectionMetadata } = require('../server/services/discordRoleConnectionService');

test('buildRoleConnectionMetadata maps verification flags correctly', () => {
  const user = {
    robloxId: '12345',
    isAuthorized: true,
    verificationStatus: {}
  };

  const metadata = buildRoleConnectionMetadata(user, {
    '35431216': true,
    '130659145': false
  });

  assert.deepEqual(metadata, {
    roblox_verified: true,
    ekoyildiz_group_member: true,
    moderator_team_group_member: false
  });
});

test('buildRoleConnectionMetadata marks everything false when user is not verified', () => {
  const metadata = buildRoleConnectionMetadata({ robloxId: null, isAuthorized: false }, {});

  assert.deepEqual(metadata, {
    roblox_verified: false,
    ekoyildiz_group_member: false,
    moderator_team_group_member: false
  });
});
