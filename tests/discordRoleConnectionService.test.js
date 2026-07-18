const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRoleConnectionMetadata } = require('../server/services/discordRoleConnectionService');

test('buildRoleConnectionMetadata maps verification flags correctly', () => {
  const user = {
    robloxId: '123456',
    robloxUsername: 'damndoggii',
    isAuthorized: true,
    verificationStatus: {}
  };

  const metadata = buildRoleConnectionMetadata(user, {});

  assert.deepEqual(metadata, {
    roblox_verified: true,
    username_is_ekonqt: true
  });
});

test('buildRoleConnectionMetadata marks everything false when user is not verified', () => {
  const metadata = buildRoleConnectionMetadata({ robloxId: null, robloxUsername: 'otheruser', isAuthorized: false }, {});

  assert.deepEqual(metadata, {
    roblox_verified: false,
    username_is_ekonqt: false
  });
});
