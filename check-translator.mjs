import { createApp } from './server.mjs';

if (!process.env.YOUDAO_APP_KEY?.trim() || !process.env.YOUDAO_APP_SECRET?.trim()) {
  console.error('尚未完整配置 YOUDAO_APP_KEY（应用 ID）和 YOUDAO_APP_SECRET（应用密钥）。请在本机 .env 中填写，不要把密钥发到聊天。');
  process.exitCode = 1;
} else {
  const app = createApp();
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${app.address().port}`;
    for (const sample of [
      { text: '我明天早上八点到酒店。', from: 'zh-Hans', to: 'en' },
      { text: 'Please bring two glasses of water.', from: 'en', to: 'zh-Hans' }
    ]) {
      const response = await fetch(base + '/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sample) });
      const result = await response.json();
      if (!response.ok || result.mode !== 'live') throw new Error(result.error || '服务未进入真实翻译模式');
      console.log(`${sample.from} → ${sample.to}: ${result.translation}`);
    }
    console.log('真实翻译服务双向连接成功。');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await new Promise(resolve => app.close(resolve)); }
}
