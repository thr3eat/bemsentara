const axios = require('axios');
const { BASE_URL } = require('../../config');

const ROLE_CONNECTION_METADATA_KEYS = {
  robloxVerified: 'roblox_verified',
  ekoYildizGroupMember: 'ekoyildiz_group_member',
  moderatorTeamGroupMember: 'moderator_team_group_member'
};

function buildRoleConnectionMetadata(user, groupMemberships = {}) {
  const verified = Boolean(user?.isAuthorized && user?.robloxId);
  const ekoGroupMember = Boolean(groupMemberships['35431216']);
  const moderatorGroupMember = Boolean(groupMemberships['130659145']);

  return {
    [ROLE_CONNECTION_METADATA_KEYS.robloxVerified]: verified,
    [ROLE_CONNECTION_METADATA_KEYS.ekoYildizGroupMember]: ekoGroupMember,
    [ROLE_CONNECTION_METADATA_KEYS.moderatorTeamGroupMember]: moderatorGroupMember
  };
}

async function updateDiscordRoleConnection(accessToken, applicationId, metadata, user) {
  if (!accessToken || !applicationId) {
    throw new Error('Discord access token ve application id gereklidir.');
  }

  const response = await axios.put(
    `https://discord.com/api/v10/users/@me/applications/${applicationId}/role-connection`,
    {
      platform_name: 'EkoYıldız', // Görseldeki pencerenin en üstünde kalın yazıyla görünecek başlık
      platform_username: user?.robloxUsername || 'Doğrulanmış Hesap', // Kullanıcının o pencerede yazacak adı
      metadata
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

async function syncRoleConnectionForUser(user, accessToken, applicationId, groupMemberships = {}) {
  const metadata = buildRoleConnectionMetadata(user, groupMemberships);
  // user objesini güncelleme fonksiyonuna paslıyoruz ki robloxUsername'i platform_username olarak basabilelim
  return updateDiscordRoleConnection(accessToken, applicationId, metadata, user);
}

module.exports = {
  ROLE_CONNECTION_METADATA_KEYS,
  buildRoleConnectionMetadata,
  updateDiscordRoleConnection,
  syncRoleConnectionForUser
};