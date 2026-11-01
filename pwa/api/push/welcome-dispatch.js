const crypto = require('node:crypto');
const webpush = require('web-push');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminHeaders(prefer) {
  const headers = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  if (SERVICE_KEY?.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  if (prefer) headers.Prefer = prefer;
  return headers;
}

function authorized(req) {
  const expected = process.env.PWA_PUSH_WEBHOOK_SECRET || '';
  const received = String(req.headers['x-pwa-webhook-secret'] || '');
  return Boolean(expected && expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received)));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  if (!SUPABASE_URL || !SERVICE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return res.status(503).json({ error: 'push_not_configured' });

  try {
    const now = new Date().toISOString();
    const query = new URLSearchParams({
      select: 'endpoint,p256dh,auth',
      welcome_due_at: `lte.${now}`,
      welcome_sent_at: 'is.null',
      order: 'welcome_due_at.asc',
      limit: '100'
    });
    const list = await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?${query}`, { headers: adminHeaders() });
    if (!list.ok) return res.status(502).json({ error: 'welcome_list_failed' });
    const subscriptions = await list.json();
    if (!subscriptions.length) return res.status(200).json({ sent: 0, total: 0 });

    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    let sent = 0, failed = 0;
    await Promise.all(subscriptions.map(async subscription => {
      try {
        const payload = JSON.stringify({
          title: 'يا هلا فيك 💙',
          body: 'يا هلا فيك! سعدنا بانضمامك لتطبيقنا 💙 تصفّحي العاملات المتاحات وباقات التأجير، وفريقنا معك إذا احتجتِ.',
          url: '/index.html?view=home',
          tag: 'rakaez-welcome',
          lang: 'ar',
          dir: 'rtl'
        });
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 60 * 60 * 24 });
        const marked = await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}&welcome_sent_at=is.null`, {
          method: 'PATCH', headers: adminHeaders('return=minimal'), body: JSON.stringify({ welcome_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        });
        if (marked.ok) sent++; else failed++;
      } catch (error) {
        failed++;
        if (error.statusCode === 404 || error.statusCode === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, { method: 'DELETE', headers: adminHeaders() });
        }
      }
    }));
    return res.status(200).json({ sent, failed, total: subscriptions.length });
  } catch (error) {
    console.error('Welcome notification dispatch failed:', error?.message || error);
    return res.status(500).json({ error: 'welcome_dispatch_failed' });
  }
};
