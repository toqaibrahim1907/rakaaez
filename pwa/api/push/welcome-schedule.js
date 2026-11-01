const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function validOrigin(req) {
  const allowed = String(process.env.PWA_ALLOWED_ORIGIN || '').replace(/\/$/, '');
  return !allowed || req.headers.origin === allowed;
}

function supabaseHeaders() {
  const headers = { apikey: SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (SERVICE_KEY?.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!validOrigin(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({ error: 'push_storage_not_configured' });

  const endpoint = String(req.body?.endpoint || '');
  if (!endpoint.startsWith('https://') || endpoint.length > 2048) return res.status(400).json({ error: 'invalid_endpoint' });

  try {
    const url = `${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&welcome_due_at=is.null&welcome_sent_at=is.null`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: supabaseHeaders(),
      body: JSON.stringify({ welcome_due_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() })
    });
    if (!response.ok) return res.status(502).json({ error: 'welcome_schedule_failed' });
    const rows = await response.json();
    return res.status(200).json({ scheduled: rows.length > 0, alreadyScheduled: rows.length === 0 });
  } catch (error) {
    console.error('Welcome notification scheduling failed:', error?.message || error);
    return res.status(500).json({ error: 'welcome_schedule_failed' });
  }
};
