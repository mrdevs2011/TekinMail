import { setCors, handleOptions } from './_cors.js';
import { setSecurityHeaders } from './_utils.js';

export default async function handler(req, res) {
  setSecurityHeaders(res);
  setCors(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return handleOptions(req, res, 'GET, OPTIONS');
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const domain = (process.env.MAIL_DOMAIN || '').trim().toLowerCase();

  return res.status(200).json({
    success: true,
    domain,
    appName: process.env.APP_NAME || 'TekinMail'
  });
}
