const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const EXTRACTION_URL = String(process.env.CV_EXTRACTION_URL || '').replace(/\/$/, '');
const EXTRACTION_SECRET = process.env.CV_EXTRACTION_SECRET || '';
const ALLOWED_ROLES = new Set(['super_admin', 'workers_manager', 'admin']);

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

async function authorize(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  if (!user?.id) return null;
  const profileUrl = new URL('/rest/v1/employee_profiles', SUPABASE_URL);
  profileUrl.search = new URLSearchParams({ user_id: `eq.${user.id}`, select: 'role,active', limit: '1' }).toString();
  const profileResponse = await fetch(profileUrl, { headers });
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json();
  const profile = profiles[0];
  if (!profile?.active || !ALLOWED_ROLES.has(profile.role)) return null;
  return { id: user.id, profile };
}

async function callExtraction(path, options = {}) {
  const response = await fetch(`${EXTRACTION_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EXTRACTION_SECRET}`,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  if (!EXTRACTION_URL || !EXTRACTION_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
    return json(res, 503, { error: 'cv_extraction_not_configured' });
  }

  try {
    const identity = await authorize(req);
    if (!identity) return json(res, 403, { error: 'employee_access_required' });

    if (req.method === 'POST') {
      const cvPath = String(req.body?.cv_path || '').trim();
      const fileName = String(req.body?.file_name || '').trim();
      const parts = cvPath.split('/');
      if (!cvPath || cvPath.length > 900 || !cvPath.toLowerCase().endsWith('.pdf') ||
          parts.some(part => !part || part === '.' || part === '..') || !fileName.toLowerCase().endsWith('.pdf')) {
        return json(res, 400, { error: 'invalid_pdf_reference' });
      }

      const objectPath = parts.map(encodeURIComponent).join('/');
      const signResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/worker-cvs/${objectPath}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${String(req.headers.authorization).replace(/^Bearer\s+/i, '')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 600 }),
        signal: AbortSignal.timeout(10000)
      });
      const signed = await signResponse.json().catch(() => ({}));
      if (!signResponse.ok || typeof (signed.signedURL || signed.signedUrl) !== 'string') {
        return json(res, signResponse.status === 403 ? 403 : 502, { error: 'private_cv_sign_failed' });
      }
      let signedUrl = signed.signedURL || signed.signedUrl;
      if (signedUrl.startsWith('/object/')) signedUrl = `/storage/v1${signedUrl}`;
      const absoluteSignedUrl = new URL(signedUrl, SUPABASE_URL).toString();
      const started = await callExtraction('/v1/jobs', {
        method: 'POST',
        body: JSON.stringify({ signed_url: absoluteSignedUrl, file_name: fileName, requested_by: identity.id })
      });
      if (!started.response.ok || !started.payload.job_id) {
        const status = started.response.status === 429 ? 429 : 502;
        return json(res, status, { error: started.response.status === 429 ? 'extraction_service_busy' : 'extraction_service_unavailable' });
      }
      return json(res, 202, { job_id: started.payload.job_id, status: started.payload.status || 'queued' });
    }

    const jobId = String(new URL(req.url, 'https://local.invalid').searchParams.get('job_id') || '');
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json(res, 400, { error: 'invalid_job_id' });
    const result = await callExtraction(`/v1/jobs/${encodeURIComponent(jobId)}?requested_by=${encodeURIComponent(identity.id)}`);
    if (result.response.status === 404) return json(res, 404, { error: 'extraction_job_not_found' });
    if (!result.response.ok) return json(res, 502, { error: 'extraction_service_unavailable' });
    return json(res, 200, result.payload);
  } catch (error) {
    console.error('Worker CV extraction request failed:', error?.message || error);
    return json(res, 502, { error: 'extraction_service_unavailable' });
  }
};
