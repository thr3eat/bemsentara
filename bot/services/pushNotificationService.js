const axios = require('axios');
require('dotenv').config();

const PUSH_API_URL = process.env.PUSH_API_URL || 'https://docs.push.techulus.com/api-documentation'; // placeholder
const PUSH_API_KEY = process.env.PUSH_API_KEY || 'YOUR_API_KEY_HERE';

/**
 * Sends a push notification via the external Push Techulus API.
 * @param {string} title - Short title for the notification.
 * @param {string} message - Detailed message body.
 * @param {object} [extra] - Optional extra data (e.g., severity, source information).
 * @returns {Promise<void>}
 */
async function sendAbuseAlert(title, message, extra = {}) {
  try {
    const payload = {
      title,
      message,
      ...extra,
    };
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PUSH_API_KEY}`,
    };
    const response = await axios.post(PUSH_API_URL, payload, { headers });
    console.log('[Push] Notification sent, status:', response.status);
  } catch (err) {
    console.error('[Push] Failed to send notification:', err.message);
  }
}

module.exports = { sendAbuseAlert };
