const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function validOrigin(req) {
  const allowed = String(process.env.PWA_ALLOWED_ORIGIN || '').replace(/\/$/, '');
  return !allowed || req.headers.origin === allowed;
}

function supabaseHeaders() {
  const headers = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  if (SERVICE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'method_not_allowed' });
  if (!validOrigin(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({ error: 'push_storage_not_configured' });

  try {
    if (req.method === 'POST' || req.method === 'PATCH') {
      const subscription = req.body?.subscription;
      const endpoint = String(subscription?.endpoint || req.body?.endpoint || '');
      const topics = req.body?.topics || {};
      const notifyWorkers = topics.workers !== false;
      const notifyRental = topics.rental !== false;
      const p256dh = String(subscription?.keys?.p256dh || '');
      const auth = String(subscription?.keys?.auth || '');
      if (!endpoint.startsWith('https://') || endpoint.length > 2048) return res.status(400).json({ error: 'invalid_endpoint' });
      if (req.method === 'POST' && (!/^[A-Za-z0-9_-]{30,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,100}$/.test(auth))) return res.status(400).json({ error: 'invalid_subscription' });
      const tableUrl = req.method === 'POST'
        ? `${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?on_conflict=endpoint`
        : `${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`;
      const response = await fetch(tableUrl, {
        method: req.method === 'POST' ? 'POST' : 'PATCH',
        headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(req.method === 'POST'
          ? { endpoint, p256dh, auth, notify_workers: notifyWorkers, notify_rental: notifyRental, user_agent: String(req.headers['user-agent'] || '').slice(0, 300), updated_at: new Date().toISOString() }
          : { notify_workers: notifyWorkers, notify_rental: notifyRental, updated_at: new Date().toISOString() })
      });
      if (!response.ok) return res.status(502).json({ error: 'subscription_save_failed' });
      return res.status(req.method === 'POST' ? 201 : 200).json({ saved: true });
    }

    const endpoint = String(req.body?.endpoint || '');
    if (!endpoint.startsWith('https://') || endpoint.length > 2048) return res.status(400).json({ error: 'invalid_endpoint' });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', headers: supabaseHeaders() });
    if (!response.ok) return res.status(502).json({ error: 'subscription_delete_failed' });
    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('Push subscription endpoint failed:', error?.message || error);
    return res.status(500).json({ error: 'push_subscription_failed' });
  }
};
