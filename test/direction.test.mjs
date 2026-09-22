import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translationDirection } from '../public/speech-session.js';
test('English input overrides a previously selected Chinese speaker',()=>{
  for(const text of ['Hello','Please bring two glasses of water.','Where is room 203?']) assert.deepEqual(translationDirection(text,'zh-Hans'),{from:'en',to:'zh-Hans'});
});
test('Chinese input overrides a previously selected English speaker',()=>{
  assert.deepEqual(translationDirection('请问早餐几点开始？','en'),{from:'zh-Hans',to:'en'});
});
test('mixed language and numbers preserve explicitly selected direction',()=>{
  for(const text of ['请问 WiFi 密码是什么','123']) for(const from of ['en','zh-Hans']) assert.equal(translationDirection(text,from).from,from);
});
