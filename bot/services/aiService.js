'use strict';

const https = require('https');
const http  = require('http');

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://openrouter.ai/api/v1';
// Render'da OPENROUTER_API_KEY veya OLLAMA_API_KEY adıyla eklenebilir
const OLLAMA_KEY  = process.env.OPENROUTER_API_KEY
                 || process.env.OLLAMA_API_KEY
                 || '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';
const AI_MODEL = 'moonshotai/kimi-k2:free';

const SYSTEM_PROMPT = `Sen Sentara destek sisteminin yapay zeka asistanısın.
Görevin: Kullanıcı bir destek ticket'ı açtığında önce onlarla konuşarak sorunlarını net anlamak.
Kurallar:
- Türkçe konuş, samimi ve yardımsever ol.
- Kullanıcının sorununu 2-3 mesajda anlayıp özetle.
- Sorunu anladıktan sonra cevabında tam olarak şu etiketi koy: [HAZIR] ve sorunu özetle.
- Asla kendin çözüm üretme, yetkililere ilet.
- Kısa ve net mesajlar yaz (max 200 karakter).
- Eğer kullanıcı selamlama mesajı atmışsa nazikçe karşıla ve ne konuda yardım istediğini sor.`;

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
    const path = url.pathname + (url.search || '');

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${OLLAMA_KEY}`,
        'HTTP-Referer': 'https://sentara.app',
        'X-Title': 'Sentara Support Bot',
      },
    };

    console.log(`[aiService] İstek → model:${AI_MODEL} key:${OLLAMA_KEY ? OLLAMA_KEY.slice(0,12)+'...' : 'BOŞ!'}`);

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        console.log(`[aiService] HTTP ${res.statusCode} yanıtı:`, data.slice(0, 300));
        try {
          const parsed = JSON.parse(data);

          if (parsed?.error) {
            const msg = typeof parsed.error === 'string'
              ? parsed.error
              : parsed.error.message || JSON.stringify(parsed.error);
            return reject(new Error(msg));
          }

          const content = parsed?.choices?.[0]?.message?.content;
          if (content) return resolve(content.trim());

          reject(new Error('AI boş yanıt. Ham: ' + data.slice(0, 200)));
        } catch (e) {
          reject(new Error('Parse hatası: ' + data.slice(0, 200)));
        }
      });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('AI timeout (30s)'));
    });

    req.on('error', (err) => {
      console.error('[aiService] Ağ hatası:', err.message);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

module.exports = { chatWithAI };
