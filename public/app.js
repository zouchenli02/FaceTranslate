import { speechSession, translationDirection } from './speech-session.js';
const $ = id => document.getElementById(id);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null, busy = false, generation = 0, controller = null, samples = [], recordingSide = null;
const languages = () => $('myLanguage').value === 'en' ? ['en','zh-Hans'] : ['zh-Hans','en'];
const speechLang = lang => lang === 'en' ? 'en-US' : 'zh-CN';
const debugEvents = [];
function debugEvent(text) {
  debugEvents.push(`${new Date().toLocaleTimeString()} ${text}`);
  if (debugEvents.length > 30) debugEvents.shift();
  const log = $('debugLog'); if (log) log.textContent = debugEvents.join('\n');
}
const status = text => { $('status').textContent = text; debugEvent(text); };
function controls() {
  $('translate').disabled = busy || !!recognition;
  $('myLanguage').disabled = busy || !!recognition;
  $('speaker').disabled = busy || !!recognition;
  $('talkMe').disabled = busy || (!!recognition && recordingSide !== 'me');
  $('talkOther').disabled = busy || (!!recognition && recordingSide !== 'other');
  const [a,b] = languages();
  const label = lang => lang === 'en' ? 'English → 中文' : '中文 → English';
  $('talkMe').textContent = recordingSide === 'me' ? '■ 结束并翻译' : `● ${label(a)}`;
  $('talkOther').textContent = recordingSide === 'other' ? '■ Stop & translate' : `● ${label(b)}`;
  $('speaker').options[0].textContent = `我 · ${label(a)}`;
  $('speaker').options[1].textContent = `对方 · ${label(b)}`;
}
function speak(text, lang) {
  if (recognition) return status('请先结束录音再播放。');
  if (!window.speechSynthesis) return status('此浏览器不支持语音播报，请阅读译文。');
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLang(lang);
  utterance.onstart = () => status('正在播报 · 点击说话可打断');
  utterance.onend = () => { if (!busy && !recognition) status('播报结束，可以继续对话'); };
  utterance.onerror = e => { if (!['interrupted','canceled'].includes(e.error)) status('播报未成功，请点击重播或阅读译文。'); };
  window.speechSynthesis.speak(utterance);
}
function addMessage(text, translation, side, to, mode, elapsed) {
  $('empty')?.remove();
  const card = document.createElement('article'); card.className = `message ${side}`;
  const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${side === 'me' ? '我' : '对方'} · ${mode === 'demo' ? '示例翻译' : '翻译'} · ${(elapsed/1000).toFixed(1)}s`;
  const original = document.createElement('p'); original.className = 'original'; original.textContent = text;
  const translated = document.createElement('p'); translated.textContent = translation;
  const replay = document.createElement('button'); replay.textContent = '▷ 重播'; replay.onclick = () => speak(translation, to);
  const edit = document.createElement('button'); edit.textContent = '修改原文'; edit.onclick = () => { if (busy || recognition) return; $('myLanguage').value = side === 'other' ? to : (to === 'en' ? 'zh-Hans' : 'en'); $('myLanguage').onchange(); $('input').value = text; $('speaker').value = side; $('input').focus(); };
  card.append(meta, original, translated, replay, edit); $('history').append(card); $('history').scrollTop = $('history').scrollHeight;
  $('partnerText').textContent = translation; $('partnerHint').textContent = to === 'en' ? 'English' : '中文';
}
async function translate() {
  if (busy || recognition) return;
  const text = $('input').value.trim(); if (!text) return status('先说一句话，或输入文字。');
  const langs = languages();
  const { from, to } = translationDirection(text, langs[$('speaker').value === 'me' ? 0 : 1]);
  const side = from === langs[0] ? 'me' : 'other';
  $('speaker').value = side;
  const version = generation, start = performance.now();
  controller = new AbortController(); busy = true; controls(); status(from === 'en' ? '正在英译中…' : '正在中译英…');
  try {
    const response = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, from, to }), signal: controller.signal });
    const data = await response.json(); if (version !== generation) return;
    if (!response.ok) throw new Error(data.error || '翻译失败，请重试。');
    addMessage(text, data.translation, side, to, data.mode, performance.now()-start);
    if ($('input').value.trim() === text) $('input').value = '';
    status('翻译完成，轮到另一方说话');
    if ($('autoPlay').checked) speak(data.translation, to);
  } catch(e) { if (version === generation && e.name !== 'AbortError') { const message = e instanceof TypeError ? '网络连接失败，文字已保留，请重试。' : e.message; status(message); $('partnerText').textContent = '本句未翻译'; $('partnerHint').textContent = message; } }
  finally { if (version === generation) { busy = false; controller = null; controls(); } }
}
function record(side) {
  if (busy) return;
  if (recognition) { recognition.stop(); return; }
  window.speechSynthesis?.cancel();
  if (!Recognition) return status('此浏览器不支持语音识别，请使用文字输入。');
  if (!window.isSecureContext) return status('麦克风需要 HTTPS 或本机 localhost，请使用文字输入。');
  $('speaker').value = side;
  const r = new Recognition(), version = generation;
  r.lang = speechLang(languages()[side === 'me' ? 0 : 1]); r.interimResults = true; r.continuous = false;
  recognition = speechSession(r, {
    onReady() { if (version === generation) status(r.lang === 'en-US' ? 'Listening in English · 请说英语，译文为中文' : '正在听中文 · 译文为 English'); },
    onRetry(attempt) { if (version === generation) status(`录音提前结束，正在重新连接（${attempt}/3）…`); },
    onEvent(event) { if (version === generation) debugEvent(`语音事件：${event}`); },
    onText(text, final) { if (version !== generation) return; $('input').value = text; status(final ? '已识别，正在结束录音…' : '正在识别 · 停顿后自动结束，也可点击结束并翻译'); },
    onComplete(text) { if (version !== generation) return; recognition = null; recordingSide = null; controls(); if (text) { $('input').value = text; translate(); } else status('没有识别到文字，请重试或手动输入。'); },
    onError(error) { if (version !== generation) return; recognition = null; recordingSide = null; controls(); const errors = { 'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许。', 'service-not-allowed': '浏览器不允许使用语音识别服务，请换用支持该服务的浏览器。', 'audio-capture': '未找到可用麦克风，请检查权限或其他 App 是否正在占用。', 'no-speech': '等待说话超时，请重新点击说话。', 'early-end': '浏览器语音服务连续提前结束，请检查麦克风权限及网络，或换浏览器重试。', 'restart-failed': '浏览器无法恢复语音服务，请重新点击说话。', network: '浏览器语音识别服务连接失败。有道文字翻译仍可用，请先输入文字。' }; status(errors[error] || `语音识别中断（${error}），已识别文字保留，可点击翻译文字。`); }
  });
  recordingSide = side; controls(); status('正在启动麦克风… 如有权限提示，请允许');
  try { r.start(); } catch { recognition?.abort(); recognition = null; recordingSide = null; controls(); status('无法启动麦克风，请输入文字。'); }
}
function renderExamples() {
  $('examples').replaceChildren();
  for (const pair of samples.slice(0,2)) for (const text of pair) { const b = document.createElement('button'); b.textContent = text; b.onclick = () => { if (busy || recognition) return; $('input').value = text; translate(); }; $('examples').append(b); }
}
$('translate').onclick = translate;
$('talkMe').onclick = () => record('me'); $('talkOther').onclick = () => record('other');
$('stopAudio').onclick = () => { window.speechSynthesis?.cancel(); if (!busy && !recognition) status('已停止播报'); };
$('flip').onclick = () => { const flipped = $('partner').classList.toggle('flipped'); $('flip').setAttribute('aria-pressed', String(flipped)); };
$('myLanguage').onchange = () => { $('otherLanguage').textContent = languages()[1] === 'en' ? 'English' : '中文 · 普通话'; controls(); renderExamples(); };
$('clear').onclick = () => { generation++; controller?.abort(); recognition?.abort(); recognition = null; recordingSide = null; busy = false; window.speechSynthesis?.cancel(); $('history').replaceChildren(); $('input').value = ''; $('partnerText').textContent = "Hello. Let's talk."; $('partnerHint').textContent = '对方的译文会显示在这里'; controls(); status('对话已清空'); };
window.addEventListener('offline', () => status('网络已断开，当前文字会保留在页面中。'));
window.addEventListener('online', () => status('网络已恢复，可以重试翻译。'));
window.addEventListener('pagehide', () => { generation++; controller?.abort(); recognition?.abort(); recognition = null; recordingSide = null; busy = false; window.speechSynthesis?.cancel(); });
window.addEventListener('pageshow', () => controls());
const diagnostics = document.createElement('details'); diagnostics.className = 'diagnostics';
const summary = document.createElement('summary'); summary.textContent = '手机调试 · 环境与事件';
const environment = document.createElement('p');
environment.textContent = `安全环境：${window.isSecureContext ? '是' : '否（录音需要 HTTPS）'} ｜ 语音识别接口：${Recognition ? '可用' : '不可用'} ｜ 播报接口：${window.speechSynthesis ? '可用' : '不可用'}。接口存在不代表语音服务一定可用。`;
const debugLog = document.createElement('pre'); debugLog.id = 'debugLog';
diagnostics.append(summary, environment, debugLog); document.querySelector('.shell').append(diagnostics);
debugEvent('页面已加载 · 双向翻译修复版 0.1.3');
window.addEventListener('error', event => debugEvent(`页面错误：${event.message}`));
window.addEventListener('unhandledrejection', () => debugEvent('发生未处理的异步错误'));
controls();
try { const response = await fetch('/api/status'); if (!response.ok) throw new Error(); const data = await response.json(); samples = data.examples; $('mode').textContent = data.mode === 'demo' ? '● 演示模式' : '● 有道翻译已配置'; $('exampleHint').textContent = data.mode === 'demo' ? '未配置服务，仅支持以下示例' : '点击开始一轮对话'; if (data.mode === 'demo') { const notice = document.createElement('p'); notice.className = 'demoNotice'; notice.textContent = '当前未配置有道应用 ID 和密钥，仅支持下方示例句。可以试说“你好，很高兴认识你”。普通中文句子暂时无法翻译。'; document.querySelector('.toolbar').after(notice); } renderExamples(); } catch { $('mode').textContent = '连接失败'; status('服务连接失败，请刷新页面重试。'); }
