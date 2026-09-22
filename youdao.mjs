import { createHash, randomUUID } from 'node:crypto';

export function signInput(text) {
  const chars = Array.from(text);
  return chars.length <= 20 ? text : chars.slice(0,10).join('') + chars.length + chars.slice(-10).join('');
}
export function buildRequest(text, from, to, appId, secret, salt = randomUUID(), curtime = String(Math.floor(Date.now()/1000))) {
  const sign = createHash('sha256').update(appId + signInput(text) + salt + curtime + secret, 'utf8').digest('hex');
  const language = value => value === 'zh-Hans' ? 'zh-CHS' : value;
  return new URLSearchParams({ q:text, from:language(from), to:language(to), appKey:appId, salt, curtime, sign, signType:'v3', strict:'true' });
}
export function providerError(code) {
  const messages = {
    '108':'有道应用 ID 无效，请检查本机配置。',
    '110':'有道应用未绑定文本翻译服务，请在有道控制台绑定。',
    '111':'有道账号无效，请检查账号状态。',
    '202':'有道签名验证失败，请检查应用 ID 和应用密钥是否匹配。',
    '203':'有道拒绝当前服务器 IP，请检查应用的 IP 限制。',
    '205':'有道应用接入方式不匹配，请使用 API 类型应用。',
    '206':'有道时间戳验证失败，请校准电脑时间。',
    '401':'有道账户余额不足，请检查服务额度。',
    '411':'有道请求过于频繁，请稍后重试。',
    '412':'有道长文本请求过于频繁，请稍后重试。'
  };
  return messages[String(code)] || '有道翻译服务返回异常，请稍后重试。';
}
