/**
 * Vercel Serverless: приём обновлений Telegram (в т.ч. web_app_data из Mini App).
 *
 * Переменные окружения в Vercel:
 *   TELEGRAM_BOT_TOKEN — токен от @BotFather
 *
 * Установка webhook (один раз, подставьте домен и токен):
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.vercel.app/api/telegram-webhook
 *
 * В боте кнопка Web App должна указывать на ваш задеплоенный URL (тот же домен, что и лендинг).
 */

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('POST only');
  }

  var token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not set' });
  }

  var update = req.body;
  if (typeof update === 'string') {
    try {
      update = JSON.parse(update);
    } catch (e) {
      return res.status(400).json({ ok: false });
    }
  }

  var msg = update && update.message;
  if (msg && msg.web_app_data && msg.web_app_data.data) {
    var dataStr = String(msg.web_app_data.data).slice(0, 4096);
    var text = 'Данные из Web App:\n' + dataStr;
    try {
      await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: msg.chat.id,
          text: text,
        }),
      });
    } catch (e) {
      console.error('[telegram-webhook] sendMessage', e);
    }
  }

  return res.status(200).json({ ok: true });
};
