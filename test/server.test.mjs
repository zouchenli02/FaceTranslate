import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
async function withServer(options, fn) { const app = createApp(options); await new Promise(resolve => app.listen(0, '127.0.0.1', resolve)); try { await fn(`http://127.0.0.1:${app.address().port}`); } finally { await new Promise(resolve => app.close(resolve)); } }
const post = (base, body) => fetch(`${base}/api/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('demo translates both directions and rejects unknown text honestly', () => withServer({ key: '' }, async base => {
  for (const [text, from, to, expected] of [['你好，很高兴认识你。','zh-Hans','en','Hello, nice to meet you.'], ['Hello, nice to meet you.','en','zh-Hans','你好，很高兴认识你。']]) { const res = await post(base, { text, from, to }); assert.equal(res.status,200); assert.equal((await res.json()).translation,expected); }
  assert.equal((await post(base, { text:'unknown', from:'en', to:'zh-Hans' })).status,422);
}));
test('validates input, malformed JSON, source and private paths', () => withServer({ key: '' }, async base => {
  for (const body of [null, {}, { text:'a', from:'en', to:'en' }, { text:'a'.repeat(2001), from:'en', to:'zh-Hans' }]) assert.equal((await post(base,body)).status,400);
  assert.equal((await fetch(`${base}/api/translate`, { method:'POST',headers:{'Content-Type':'application/json'},body:'{' })).status,400);
  assert.equal((await fetch(`${base}/api/translate`, { method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}' })).status,403);
  assert.equal((await fetch(`${base}/.env`)).status,404);
  assert.equal((await post(base,{text:'x'.repeat(20000)})).status,413);
}));
test('live Youdao adapter signs requests and maps languages', () => withServer({ key:'test-secret', appId:'test-app', fetcher: async (url, init) => { assert.equal(url,'https://openapi.youdao.com/api'); const form=new URLSearchParams(init.body); assert.equal(form.get('from'),'en'); assert.equal(form.get('to'),'zh-CHS'); assert.equal(form.get('q'),'Hello'); assert.equal(form.get('signType'),'v3'); assert.match(form.get('sign'),/^[a-f0-9]{64}$/); assert.ok(!init.body.includes('test-secret')); return new Response(JSON.stringify({errorCode:'0',translation:['你好']})); } }, async base => {
  const status = await (await fetch(`${base}/api/status`)).text(); assert.ok(!status.includes('test-secret')); assert.ok(!status.includes('test-app'));
  const res = await post(base,{text:'Hello',from:'en',to:'zh-Hans'}); assert.deepEqual(await res.json(),{translation:'你好',mode:'live'});
}));
test('upstream errors are sanitized and malformed results rejected', async () => {
  for (const fetcher of [async()=>new Response('secret',{status:401}),async()=>new Response('[]'),async()=>new Response('{"errorCode":"0","translation":[]}'),async()=>{throw new DOMException('secret','TimeoutError');}]) await withServer({key:'secret',appId:'test-app',fetcher},async base=> { const res=await post(base,{text:'Hello',from:'en',to:'zh-Hans'});assert.equal(res.status,502);assert.ok(!(await res.text()).includes('secret')); });
});
test('partial credentials fail explicitly without calling the provider', () => withServer({key:'secret',appId:'',fetcher:()=>{throw new Error('must not call');}},async base=> {assert.equal((await post(base,{text:'hello',from:'en',to:'zh-Hans'})).status,503);}));
test('Youdao service binding and balance errors are actionable', async()=>{
  for (const [code,expected] of [['110','未绑定'],['202','签名'],['401','余额'],['411','频繁']]) await withServer({key:'secret',appId:'app',fetcher:async()=>new Response(JSON.stringify({errorCode:code}))},async base=>{const res=await post(base,{text:'hello',from:'en',to:'zh-Hans'});assert.equal(res.status,502);assert.ok((await res.json()).error.includes(expected));});
});
test('serves mobile application with security headers', () => withServer({key:''}, async base => { const res=await fetch(base);assert.equal(res.status,200);assert.match(await res.text(),/viewport/);assert.ok(res.headers.get('content-security-policy')); }));
