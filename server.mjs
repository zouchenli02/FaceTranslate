import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildRequest, providerError } from './youdao.mjs';

export const examples = [
  ['你好，很高兴认识你。', 'Hello, nice to meet you.'],
  ['请问最近的地铁站在哪里？', 'Where is the nearest subway station?'],
  ['我想要一杯咖啡，谢谢。', 'I would like a cup of coffee, please.'],
  ['请问这个多少钱？', 'How much does this cost?'],
  ['可以再说一遍吗？', 'Could you say that again?'],
  ['当然，没问题。', 'Of course, no problem.'],
];
const normalize = s => s.toLowerCase().replace(/[\s。？?！!，,.]/g, '');
const assets = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']], ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']], ['/icon.svg', ['icon.svg', 'image/svg+xml']]]);
assets.set('/speech-session.js', ['speech-session.js', 'text/javascript']);
export function createApp({ key = process.env.YOUDAO_APP_SECRET, appId = process.env.YOUDAO_APP_KEY, fetcher = fetch } = {}) {
  key = key?.trim(); appId = appId?.trim();
  const configured = Boolean(key && appId);
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; frame-ancestors 'none'");
    const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && path === '/api/status') return json(200, { mode: configured ? 'live' : 'demo', provider:'youdao', examples });
      if (req.method === 'POST' && path === '/api/translate') {
        if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) return json(403, { error: '请求来源不匹配。' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: '需要 JSON 请求。' });
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) { json(413, { error: '内容过长，请分句翻译。' }); return; }
          chunks.push(chunk);
        }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(400, { error: '请求格式错误。' }); }
        const { text, from, to } = body ?? {};
        if (typeof text !== 'string' || !text.trim() || text.length > 2000 || !['zh-Hans', 'en'].includes(from) || !['zh-Hans', 'en'].includes(to) || from === to) return json(400, { error: '请输入 1–2000 字，并选择不同语言。' });
        if (!configured) {
          if (key || appId) return json(503, { error:'有道配置不完整，请同时填写应用 ID 和应用密钥。' });
          const i = from === 'en' ? 1 : 0;
          const pair = examples.find(p => normalize(p[i]) === normalize(text));
          if (!pair) return json(422, { error: '演示模式仅支持示例句。配置翻译服务后可翻译任意内容。' });
          return json(200, { translation: pair[1-i], mode: 'demo' });
        }
        const upstream = await fetcher('https://openapi.youdao.com/api', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: buildRequest(text.trim(), from, to, appId, key).toString(), signal: AbortSignal.timeout(12000) });
        if (!upstream.ok) return json(502, { error: upstream.status === 429 ? '翻译服务繁忙，请稍后重试。' : '翻译服务不可用，请检查服务配置后重试。' });
        const result = await upstream.json();
        if (String(result?.errorCode) !== '0') return json(502, { error:providerError(result?.errorCode) });
        const translation = Array.isArray(result.translation) && result.translation.every(t => typeof t === 'string') ? result.translation.join('\n') : null;
        if (typeof translation !== 'string' || !translation.trim()) throw new Error('Invalid response');
        return json(200, { translation, mode: 'live' });
      }
      if (req.method !== 'GET' || !assets.has(path)) return json(404, { error: '页面不存在。' });
      const [file, type] = assets.get(path);
      const data = await readFile(new URL(`./public/${file}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      res.end(data);
    } catch (error) { if (!res.headersSent) json(502, { error: error.name === 'TimeoutError' ? '翻译超时，请重试。' : '服务暂时不可用，请重试。' }); else res.end(); }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 3100);
  const host = process.env.HOST || '127.0.0.1';
  createApp().listen(port, host, () => console.log(`FaceTranslate running at http://${host}:${port}`));
}
