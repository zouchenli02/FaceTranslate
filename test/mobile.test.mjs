import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMobileApp } from '../mobile-server.mjs';
test('mobile debug protects every route and permits valid credentials', async () => {
  const app = createMobileApp('test-password-123456', {key:''});
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  try {
    for (const path of ['/', '/app.js', '/api/status', '/api/translate']) {
      const r = await fetch(base+path); assert.equal(r.status,401); assert.match(r.headers.get('www-authenticate'),/Basic/);
    }
    assert.equal((await fetch(base, {headers:{authorization:'Basic wrong'}})).status,401);
    const r = await fetch(base+'/api/status',{headers:{authorization:'Basic '+Buffer.from('debug:test-password-123456').toString('base64')}});
    assert.equal(r.status,200); assert.equal((await r.json()).mode,'demo');
  } finally { await new Promise(resolve=>app.close(resolve)); }
});
