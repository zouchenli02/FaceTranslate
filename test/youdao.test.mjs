import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildRequest, signInput } from '../youdao.mjs';
test('Youdao v3 short text signature matches known inputs',()=>{
  const form=buildRequest('你好','zh-Hans','en','app','secret','salt','123');
  assert.equal(form.get('sign'),createHash('sha256').update('app你好salt123secret').digest('hex'));
  assert.equal(form.get('from'),'zh-CHS'); assert.equal(form.get('to'),'en');
});
test('long signing input counts Unicode characters',()=>{
  assert.equal(signInput('12345678901234567890'),'12345678901234567890');
  assert.equal(signInput('1234567890Xabcdefghij'),'123456789021abcdefghij');
  assert.equal(signInput('😀'.repeat(21)),'😀'.repeat(10)+'21'+'😀'.repeat(10));
});
test('requests have unique salt and encode form characters correctly',()=>{
  const a=buildRequest('a&b + c','en','zh-Hans','app','secret');
  const b=buildRequest('a&b + c','en','zh-Hans','app','secret');
  assert.notEqual(a.get('salt'),b.get('salt'));
  assert.equal(new URLSearchParams(a.toString()).get('q'),'a&b + c');
});
