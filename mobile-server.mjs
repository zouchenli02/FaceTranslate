import { timingSafeEqual, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './server.mjs';

export function createMobileApp(password, options = {}) {
  if (!password || password.length < 16) throw new Error('调试口令至少需要 16 个字符');
  const app = createApp(options);
  const handler = app.listeners('request')[0];
  app.removeAllListeners('request');
  const expected = Buffer.from('Basic ' + Buffer.from(`debug:${password}`).toString('base64'));
  app.on('request', (req, res) => {
    const actual = Buffer.from(req.headers.authorization || '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="FaceTranslate mobile debug", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end('请输入本次手机调试的用户名和口令。');
    }
    return handler(req, res);
  });
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = new URL('./.debug/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  const file = new URL('password.txt', dir);
  let password;
  try { password = readFileSync(file, 'utf8').trim(); } catch { password = randomBytes(12).toString('hex'); writeFileSync(file, password); }
  createMobileApp(password).listen(3101, '127.0.0.1', () => console.log('Mobile debug listening on 127.0.0.1:3101. Credentials: debug / .debug/password.txt'));
}
