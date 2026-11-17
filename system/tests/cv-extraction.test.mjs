import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { handleCvExtraction } from "../scripts/api/worker-extraction.mjs";
function response() { return { status: 0, body: "", writeHead(code) { this.status = code; }, end(body) { this.body = JSON.parse(body); } }; }
const org="11111111-1111-4111-8111-111111111111", user="22222222-2222-4222-8222-222222222222", worker="33333333-3333-4333-8333-333333333333";
function req(body, token="user-token") { return { method:"POST", url:"/api/worker-extraction", headers:{authorization:`Bearer ${token}`}, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)); } }; }
test("CV extraction proxy checks website permission and scoped signed files", async () => {
  process.env.SUPABASE_URL="https://example.supabase.co"; process.env.SUPABASE_PUBLISHABLE_KEY="sb_publishable_test";
  process.env.CV_EXTRACTION_URL="http://127.0.0.1:8767"; process.env.CV_EXTRACTION_SECRET="server-only-secret";
  let permissions=["rental.website.write"], calls=[];
  const fake=mock.method(globalThis,"fetch",async (url, options={}) => {
    calls.push({url:String(url),options});
    if(String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({id:user}),{status:200});
    if(String(url).endsWith('/rest/v1/rpc/rental_context')) return new Response(JSON.stringify({organization_id:org,permissions}),{status:200});
    if(String(url).includes('/storage/v1/object/sign/website-worker-cvs/')) return new Response(JSON.stringify({signedURL:'/object/sign/website-worker-cvs/file?token=test'}),{status:200});
    if(String(url).endsWith('/v1/jobs')) return new Response(JSON.stringify({job_id:'44444444-4444-4444-8444-444444444444'}),{status:202});
    throw Error('unexpected fetch');
  });
  try {
    let res=response(); await handleCvExtraction(req({cv_path:`${org}/${worker}/file`,file_name:'cv.pdf'}),res); assert.equal(res.status,202);
    assert.equal(calls.at(-1).options.headers.Authorization,'Bearer server-only-secret');
    assert.equal(JSON.parse(calls.at(-1).options.body).requested_by,user);
    assert.doesNotMatch(JSON.stringify(res.body),/server-only-secret/);
    calls=[]; res=response(); await handleCvExtraction(req({cv_path:`other/${worker}/file`,file_name:'cv.pdf'}),res); assert.equal(res.status,400); assert.equal(calls.length,2);
    permissions=[]; calls=[]; res=response(); await handleCvExtraction(req({cv_path:`${org}/${worker}/file`,file_name:'cv.pdf'}),res); assert.equal(res.status,403); assert.equal(calls.length,2);
    process.env.CV_EXTRACTION_URL='http://example.invalid'; calls=[]; res=response(); await handleCvExtraction(req({cv_path:`${org}/${worker}/file`,file_name:'cv.pdf'}),res); assert.equal(res.status,503); assert.equal(calls.length,0);
  } finally { fake.mock.restore(); }
});
