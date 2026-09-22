import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speechSession } from '../public/speech-session.js';
function setup() {
  const timers = new Map(); let id = 0; const complete = [], errors = [];
  const r = { started:0, start() { this.started++; }, stopped:0, stop() { this.stopped++; }, abort() {} };
  const session = speechSession(r, { onText() {}, onComplete:t=>complete.push(t), onError:e=>errors.push(e), setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;}, clearTimer:id=>timers.delete(id) });
  const result = (text, final=false) => { const item = [{transcript:text}]; item.isFinal=final; r.onresult({results:[item]}); };
  const tick = ms => { const callbacks=[...timers.entries()].filter(([,v])=>ms === undefined || v.ms === ms); callbacks.forEach(([id])=>timers.delete(id)); callbacks.forEach(([,v])=>v.fn()); };
  return { r,session,result,tick,complete,errors };
}
test('Safari interim-only end still translates recognized text',()=>{const s=setup();s.result('你好');s.r.onend();assert.deepEqual(s.complete,['你好']);});
test('final result stops recording and missing end has a bounded fallback',()=>{const s=setup();s.result('你好',true);assert.equal(s.r.stopped,1);s.tick();s.r.onend();assert.deepEqual(s.complete,['你好']);});
test('silence ends interim recording and translates once',()=>{const s=setup();s.result('你好');s.tick();assert.equal(s.r.stopped,1);s.tick();assert.deepEqual(s.complete,['你好']);});
test('manual stop accepts final refinement before completion',()=>{const s=setup();s.result('你');s.session.stop();s.result('你好',true);s.r.onend();s.tick();assert.deepEqual(s.complete,['你好']);});
test('clear abort ignores late recognition callbacks',()=>{const s=setup();s.result('你好');s.session.abort();s.r.onend();s.tick();assert.deepEqual(s.complete,[]);});
test('recognition error does not submit a translation',()=>{const s=setup();s.result('你好');s.r.onerror({error:'network'});s.r.onend();s.tick();assert.deepEqual(s.complete,[]);assert.deepEqual(s.errors,['network']);});
test('empty Android results never end a recording',()=>{const s=setup();s.r.onresult({results:[]});s.result('',true);s.tick();assert.equal(s.r.stopped,0);assert.deepEqual(s.complete,[]);});
test('early Android end restarts then accepts speech',()=>{const s=setup();s.r.onend();s.tick(600);assert.equal(s.r.started,1);s.result('你好',true);s.r.onend();assert.deepEqual(s.complete,['你好']);});
test('no-speech waits for end before restart',()=>{const s=setup();s.r.onstart();s.r.onerror({error:'no-speech'});assert.deepEqual(s.errors,[]);assert.equal(s.r.started,0);s.r.onend();s.tick(600);assert.equal(s.r.started,1);});
test('early end retries are bounded',()=>{const s=setup();for(let i=0;i<4;i++){s.r.onend();s.tick(600);}assert.equal(s.r.started,3);assert.deepEqual(s.errors,['early-end']);});
test('manual stop cancels pending restart',()=>{const s=setup();s.r.onend();s.session.stop();s.tick();assert.equal(s.r.started,0);assert.deepEqual(s.complete,['']);});
test('permission denial is not retried',()=>{const s=setup();s.r.onerror({error:'not-allowed'});s.r.onend();s.tick();assert.equal(s.r.started,0);assert.deepEqual(s.errors,['not-allowed']);});
test('waiting for speech has a 15-second limit',()=>{const s=setup();s.r.onstart();s.tick(15000);assert.deepEqual(s.errors,['no-speech']);});
test('abort cancels pending restart',()=>{const s=setup();s.r.onend();s.session.abort();s.tick();assert.equal(s.r.started,0);assert.deepEqual(s.complete,[]);});
