export function translationDirection(text, preferred = 'zh-Hans') {
  const chinese = /\p{Script=Han}/u.test(text);
  const english = /[a-z]/i.test(text);
  const from = english && !chinese ? 'en' : chinese && !english ? 'zh-Hans' : preferred;
  return { from, to: from === 'en' ? 'zh-Hans' : 'en' };
}
// Safari may deliver interim text without a final result or a timely end event.
export function speechSession(recognizer, { onText, onComplete, onError, onReady = () => {}, onRetry = () => {}, onEvent = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let text = '', settled = false, stopping = false, silenceTimer, endTimer, retryTimer, initialTimer, retries = 0;
  const clean = () => { clearTimer(silenceTimer); clearTimer(endTimer); clearTimer(retryTimer); clearTimer(initialTimer); };
  const fail = error => { if (settled) return; settled = true; clean(); try { recognizer.abort(); } catch {} onError(error); };
  const finish = () => {
    if (settled) return;
    settled = true; clean();
    try { recognizer.abort(); } catch {}
    onComplete(text.trim());
  };
  const stop = () => {
    if (settled || stopping) return;
    stopping = true; clearTimer(silenceTimer);
    clearTimer(retryTimer);
    // Set before stop(), since a mock or browser may fire end synchronously.
    endTimer = setTimer(finish, 1500);
    try { recognizer.stop(); } catch { finish(); }
  };
  recognizer.onresult = event => {
    if (settled) return;
    const next = Array.from(event.results, result => result[0].transcript).join('').slice(0, 2000);
    // Empty result lists pass every(isFinal); they must not stop a new recording.
    if (!next.trim()) return;
    text = next; clearTimer(initialTimer);
    const final = Array.from(event.results).every(result => result.isFinal);
    onText(text, final); clearTimer(silenceTimer);
    if (final) stop(); else if (!stopping) silenceTimer = setTimer(stop, 1800);
  };
  recognizer.onstart = () => {
    if (settled || stopping) return;
    onEvent('start'); onReady();
    if (!initialTimer) initialTimer = setTimer(() => fail('no-speech'), 15000);
  };
  recognizer.onaudiostart = () => { if (!settled) onEvent('audio-start'); };
  recognizer.onend = () => {
    if (settled) return;
    onEvent('end');
    if (text.trim() || stopping) return finish();
    if (retries >= 3) return fail('early-end');
    retries++; onRetry(retries);
    retryTimer = setTimer(() => {
      if (settled || stopping) return;
      try { recognizer.start(); } catch { fail('restart-failed'); }
    }, 600);
  };
  recognizer.onerror = event => {
    if (settled) return;
    onEvent(`error:${event.error}`);
    // no-speech is recoverable only before any text; restart after the end event.
    if (event.error === 'no-speech' && !text.trim() && !stopping) {
      if (!initialTimer) initialTimer = setTimer(() => fail('no-speech'), 15000);
      return;
    }
    fail(event.error);
  };
  return { stop, abort() { settled = true; clean(); try { recognizer.abort(); } catch {} } };
}
