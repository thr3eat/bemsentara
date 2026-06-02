'use strict';

const https = require('https');
const http  = require('http');

const OLLAMA_BASE = 'https://api.groq.com/openai/v1';
const OLLAMA_KEY  = process.env.OPENROUTER_API_KEY
                 || process.env.OLLAMA_API_KEY
                 || process.env.GROQ_API_KEY
                 || '';
const MODELS = process.env.AI_MODEL
  ? [process.env.AI_MODEL]
  : ['llama-3.1-8b-instant', 'llama3-8b-8192', 'gemma2-9b-it'];

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
 * Tek bir modele istek at
 */
function requestModel(model, messages, systemContent) {
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemContent },
      ...messages,
    ],
    stream: false,
    max_tokens: 300,
    temperature: 0.7,
  });

  return new Promise((resolve, reject) => {
    const base = OLLAMA_BASE.replace(/\/+$/, '');
    let url;
    try {
      url = new URL(`${base}/chat/completions`);
    } catch (e) {
      return reject(new Error(`Geçersiz URL: ${base}`));
    }

    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ''),
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
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          // Hata kontrolü
          if (parsed?.error) {
            const msg = typeof parsed.error === 'string'
              ? parsed.error
              : (parsed.error.message || JSON.stringify(parsed.error));
            return reject(new Error(msg));
          }

          const content = parsed?.choices?.[0]?.message?.content;
          if (content) return resolve(content.trim());

          reject(new Error(`Boş yanıt (HTTP ${res.statusCode}): ` + data.slice(0, 150)));
        } catch (e) {
          reject(new Error(`Parse hatası (HTTP ${res.statusCode}): ` + data.slice(0, 150)));
        }
      });
    });

    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error(`Timeout: ${model}`));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Model listesini sırayla dener, ilk başarılı yanıtı döner
 * @param {Array} messages - [{role, content}]
 * @param {string} [customSystemPrompt] - Özel system prompt (opsiyonel)
 */
async function chatWithAI(messages, customSystemPrompt) {
  const systemContent = customSystemPrompt || SYSTEM_PROMPT;
  let lastErr;
  for (const model of MODELS) {
    try {
      console.log(`[aiService] Deneniyor: ${model}`);
      const result = await requestModel(model, messages, systemContent);
      console.log(`[aiService] Başarılı: ${model}`);
      return result;
    } catch (err) {
      console.warn(`[aiService] ${model} başarısız: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('Tüm AI modelleri başarısız oldu');
}

module.exports = { chatWithAI };
