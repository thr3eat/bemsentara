const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRoleConnectionMetadata } = require('../server/services/discordRoleConnectionService');

test('buildRoleConnectionMetadata maps verification flags correctly', () => {
  const user = {
    robloxUsername: 'ekonqt',
    isAuthorized: true,
    verificationStatus: {}
  };

  const metadata = buildRoleConnectionMetadata(user, {
    '130659145': false
  });

  assert.deepEqual(metadata, {
    roblox_verified: true,
    username_is_ekonqt: true,
    moderator_team_group_member: false
  });
});

test('buildRoleConnectionMetadata marks everything false when user is not verified', () => {
  const metadata = buildRoleConnectionMetadata({ robloxId: null, robloxUsername: 'otheruser', isAuthorized: false }, {});

  assert.deepEqual(metadata, {
    roblox_verified: false,
    username_is_ekonqt: false,
    moderator_team_group_member: false
  });
});
