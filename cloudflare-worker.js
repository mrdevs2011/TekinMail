export default {
  async email(message, env, ctx) {
    try {
      const to = (message.to || '').toLowerCase().trim();
      const from = message.from || '';
      const subject = message.headers.get('subject') || 'No Subject';
      const fromName = message.headers.get('from') || from;

      const rawText = await new Response(message.raw).text();

      let bodyText = '';
      const splitBody = rawText.split(/\r?\n\r?\n/);
      if (splitBody.length > 1) {
        bodyText = splitBody.slice(1).join('\n\n');
      } else {
        bodyText = rawText;
      }

      const targetApiUrl = env.TEKINMAIL_API_URL || 'https://tekinmail.vercel.app/api/incoming-email';
      const headers = { 'Content-Type': 'application/json' };

      // WEBHOOK_SECRET Cloudflare Worker env da sozlang
      if (env.WEBHOOK_SECRET) {
        headers['X-Webhook-Secret'] = env.WEBHOOK_SECRET;
      }

      const res = await fetch(targetApiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to,
          from,
          from_name: fromName,
          subject,
          raw: rawText,
          body: bodyText,
          html: ''
        })
      });

      console.log('TekinMail Forward Status:', res.status);
    } catch (err) {
      console.error('Error forwarding email:', err);
    }
  }
};
