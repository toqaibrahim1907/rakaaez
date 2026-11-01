const crypto = require('node:crypto');
const webpush = require('web-push');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminHeaders() {
  const headers = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  if (SERVICE_KEY?.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}

function authorized(req) {
  const expected = process.env.PWA_PUSH_WEBHOOK_SECRET || '';
  const received = String(req.headers['x-pwa-webhook-secret'] || '');
  if (!expected || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  if (!SUPABASE_URL || !SERVICE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return res.status(503).json({ error: 'push_not_configured' });
  const worker = req.body?.record;
  if (!worker || worker.publication !== 'منشورة' || worker.availability !== 'متاحة' || !worker.ref) return res.status(400).json({ error: 'worker_not_public' });

  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const query = `${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?select=endpoint,p256dh,auth&notify_workers=eq.true`;
    const result = await fetch(query, { headers: adminHeaders() });
    if (!result.ok) return res.status(502).json({ error: 'subscription_list_failed' });
    const subscriptions = await result.json();
    const nationality = String(worker.nationality || '').trim();
    const profession = String(worker.profession || 'عاملة منزلية').trim();
    const body = nationality
      ? `تصفّحي عاملة ${profession} من ${nationality} المتاحة الآن، وشوفي تفاصيلها بالتطبيق.`
      : `تصفّحي ملف ${profession} الجديد وشوفي تفاصيله في التطبيق.`;
    const payload = JSON.stringify({ title: 'الركائز البشرية للاستقدام', body: `عاملة جديدة متاحة — ${body}`, url: `/index.html?view=workers&ref=${encodeURIComponent(worker.ref)}`, tag: `worker-${worker.ref}` });
    let sent = 0, failed = 0;
    await Promise.all(subscriptions.map(async subscription => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (error) {
        failed++;
        if (error.statusCode === 404 || error.statusCode === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, { method: 'DELETE', headers: adminHeaders() });
        }
      }
    }));
    return res.status(200).json({ sent, failed, total: subscriptions.length });
  } catch (error) {
    console.error('Automatic worker notification failed:', error?.message || error);
    return res.status(500).json({ error: 'worker_notification_failed' });
  }
};
