const json = (res, status, value) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(value));
};
async function readBody(req) {
  let result = "";
  for await (const chunk of req) {
    result += chunk;
    if (Buffer.byteLength(result) > 4096) throw new Error("body_too_large");
  }
  return JSON.parse(result || "{}");
}
export async function handleCvExtraction(req, res) {
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { error: "method_not_allowed" });
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const serviceUrl = String(process.env.CV_EXTRACTION_URL || "").replace(/\/$/, "");
  const secret = process.env.CV_EXTRACTION_SECRET || "";
  if (!supabaseUrl || !key.startsWith("sb_publishable_") || !serviceUrl || !secret) return json(res, 503, { error: "cv_extraction_not_configured" });
  try {
    const endpoint = new URL(serviceUrl);
    if (endpoint.username || endpoint.password || (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["127.0.0.1", "localhost"].includes(endpoint.hostname)))) return json(res, 503, { error: "cv_extraction_not_configured" });
  } catch { return json(res, 503, { error: "cv_extraction_not_configured" }); }
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(\S+)$/i);
  if (!match) return json(res, 403, { error: "employee_access_required" });
  const headers = { apikey: key, Authorization: `Bearer ${match[1]}` };
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) });
    if (!userResponse.ok) return json(res, 403, { error: "employee_access_required" });
    const user = await userResponse.json();
    const contextResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/rental_context`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(10000) });
    if (!contextResponse.ok) return json(res, 403, { error: "employee_access_required" });
    const context = await contextResponse.json();
    if (!user?.id || !context?.organization_id || !context.permissions?.includes("rental.website.write")) return json(res, 403, { error: "employee_access_required" });
    let route, body;
    if (req.method === "POST") {
      body = await readBody(req);
      const cvPath = String(body.cv_path || ""), filename = String(body.file_name || "");
      const parts = cvPath.split("/");
      if (parts.length !== 3 || parts[0] !== context.organization_id || parts.some(part => !part || part === "." || part === "..") || cvPath.length > 900 || !filename.toLowerCase().endsWith(".pdf")) return json(res, 400, { error: "invalid_pdf_reference" });
      const objectPath = parts.map(encodeURIComponent).join("/");
      const sign = await fetch(`${supabaseUrl}/storage/v1/object/sign/website-worker-cvs/${objectPath}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 600 }), signal: AbortSignal.timeout(10000) });
      const signed = await sign.json().catch(() => ({}));
      if (!sign.ok || !(signed.signedURL || signed.signedUrl)) return json(res, 403, { error: "private_cv_sign_failed" });
      let signedUrl = signed.signedURL || signed.signedUrl;
      if (signedUrl.startsWith("/object/")) signedUrl = `/storage/v1${signedUrl}`;
      signedUrl = new URL(signedUrl, supabaseUrl).toString();
      route = "/v1/jobs";
      body = { signed_url: signedUrl, file_name: filename.slice(0, 200), requested_by: user.id };
    } else {
      const job = new URL(req.url, "http://localhost").searchParams.get("job_id") || "";
      if (!/^[0-9a-f-]{36}$/i.test(job)) return json(res, 400, { error: "invalid_job_id" });
      route = `/v1/jobs/${encodeURIComponent(job)}?requested_by=${encodeURIComponent(user.id)}`;
    }
    const response = await fetch(`${serviceUrl}${route}`, { method: req.method, headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
    const payload = await response.json().catch(() => ({}));
    return json(res, response.ok ? response.status : 502, response.ok ? payload : { error: "extraction_service_unavailable" });
  } catch { return json(res, 502, { error: "extraction_service_unavailable" }); }
}
