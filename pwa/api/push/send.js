const webpush = require('web-push');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

function adminHeaders() {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
}

async function requireSuperAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return false;
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!authResponse.ok) return false;
  const user = await authResponse.json();
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/employee_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=role,active&limit=1`, { headers: adminHeaders() });
  if (!profileResponse.ok) return false;
  const profiles = await profileResponse.json();
  return profiles[0]?.role === 'super_admin' && profiles[0]?.active === true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT || !SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return res.status(503).json({ error: 'push_not_configured' });
  try {
    if (!await requireSuperAdmin(req)) return res.status(403).json({ error: 'super_admin_required' });
    const title = String(req.body?.title || '').trim().slice(0, 80);
    const body = String(req.body?.body || '').trim().slice(0, 240);
    const target = String(req.body?.url || '/index.html').trim();
    if (!title || !body || !target.startsWith('/') || target.startsWith('//')) return res.status(400).json({ error: 'invalid_notification' });

    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const list = await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?select=endpoint,p256dh,auth`, { headers: adminHeaders() });
    if (!list.ok) return res.status(502).json({ error: 'subscription_list_failed' });
    const subscriptions = await list.json();
    const payload = JSON.stringify({ title, body, url: target, tag: `rakaez-${Date.now()}` });
    let sent = 0, failed = 0;
    await Promise.all(subscriptions.map(async row => {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (error) {
        failed++;
        if (error.statusCode === 404 || error.statusCode === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?endpoint=eq.${encodeURIComponent(row.endpoint)}`, { method: 'DELETE', headers: adminHeaders() });
        }
      }
    }));
    return res.status(200).json({ sent, failed, total: subscriptions.length });
  } catch (error) {
    console.error('Push send failed:', error?.message || error);
    return res.status(500).json({ error: 'push_send_failed' });
  }
};
