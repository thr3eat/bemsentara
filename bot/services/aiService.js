'use strict';

/**
 * OpenRouter AI Servisi (MoonshotAI Kimi)
 * Kullanım: OpenRouter (https://openrouter.ai) üzerinden MoonshotAI `kimi-2.6` modelini kullanır.
 * Ayarlar: `OPENROUTER_API_KEY` veya `OLLAMA_API_KEY` çevre değişkeni ile API anahtarınızı sağlayın.
 */

const https = require('https');
const http  = require('http');

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://openrouter.ai/api/v1';
const OLLAMA_KEY  = process.env.OPENROUTER_API_KEY || process.env.OLLAMA_API_KEY || '';
const AI_MODEL    = process.env.AI_MODEL        || 'moonshotai/kimi-2.6:free';

const SYSTEM_PROMPT = `Sen Sentara destek sisteminin yapay zeka asistanısın.
Görevin: Kullanıcı bir destek ticket'ı açtığında önce onlarla konuşarak sorunlarını net anlamak.
Kurallar:
- Türkçe konuş, samimi ve yardımsever ol.
- Kullanıcının sorununu 2-3 mesajda anlayıp özetle.
- Sorunu anladıktan sonra cevabında tam olarak şu etiketi koy: [HAZIR] ve sorunu özetle.
- Asla kendin çözüm üretme, yetkililere ilet.
- Kısa ve net mesajlar yaz (max 200 karakter).
- Eğer kullanıcı selamlama mesajı atmışsa nazikçe karşıla ve ne konuda yardım istediğini sor.`;

/**
 * Ollama / OpenRouter'a chat isteği atar
 * @param {Array} messages - [{role, content}]
 * @returns {Promise<string>} - AI yanıtı
 */
async function chatWithAI(messages) {
  const body = JSON.stringify({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    stream: false,
    max_tokens: 300,
    temperature: 0.7,
  });

  return new Promise((resolve, reject) => {
    // Base URL'nin sonundaki slash'ı temizle
    const base = OLLAMA_BASE.replace(/\/+$/, '');
    const fullUrl = `${base}/chat/completions`;
    
    let url;
    try {
      url = new URL(fullUrl);
    } catch (e) {
      return reject(new Error(`Geçersiz AI URL: ${fullUrl}`));
    }
    
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${OLLAMA_KEY}`,
        'HTTP-Referer': 'https://sentara.app',
        'X-Title': 'Sentara Support Bot',
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const content = parsed?.choices?.[0]?.message?.content;
          if (content) return resolve(content.trim());
          // Hata mesajı varsa
          if (parsed?.error) return reject(new Error(parsed.error.message || 'AI hatası'));
          reject(new Error('AI boş yanıt döndürdü'));
        } catch (e) {
          reject(new Error('AI yanıtı parse edilemedi: ' + data.slice(0, 100)));
        }
      });
    });

    req.setTimeout(15000, () => { req.destroy(); reject(new Error('AI timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { chatWithAI };
