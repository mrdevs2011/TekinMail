export default {
  async email(message, env, ctx) {
    try {
      const to = (message.to || '').toLowerCase().trim();
      const from = message.from || '';
      const subject = message.headers.get('subject') || 'No Subject';
      const fromName = message.headers.get('from') || from;

      // Xatning to'liq xom matnini o'qish
      const rawText = await new Response(message.raw).text();

      // Xat tanasi (body) ajratish
      let bodyText = '';
      const splitBody = rawText.split(/\r?\n\r?\n/);
      if (splitBody.length > 1) {
        bodyText = splitBody.slice(1).join('\n\n');
      } else {
        bodyText = rawText;
      }

      // TekinMail Vercel API'ga yuborish
      const targetApiUrl = env.TEKINMAIL_API_URL || 'https://tekinmail.vercel.app/api/incoming-email';

      const res = await fetch(targetApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: to,
          from: from,
          from_name: fromName,
          subject: subject,
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
