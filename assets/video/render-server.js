const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outputDir = path.join(root, 'assets', 'video');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm'};

function loadLocalEnv(){
  try{for(const line of fs.readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!match||match[1].startsWith('#')||process.env[match[1]])continue;process.env[match[1]]=match[2].replace(/^(["'])(.*)\1$/,'$2')}}catch{}
}
loadLocalEnv();

const chatRate=new Map();
function sendJson(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
function rateAllowed(ip){const now=Date.now(),entry=chatRate.get(ip)||{start:now,count:0};if(now-entry.start>60000){entry.start=now;entry.count=0}entry.count++;chatRate.set(ip,entry);if(chatRate.size>5000){for(const [key,value] of chatRate)if(now-value.start>120000)chatRate.delete(key)}return entry.count<=15}
function readJson(req,limit=16000){return new Promise((resolve,reject)=>{let raw='',size=0;req.on('data',chunk=>{size+=chunk.length;if(size>limit){reject(new Error('too_large'));req.destroy();return}raw+=chunk});req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'))}catch{reject(new Error('invalid_json'))}});req.on('error',reject)})}

async function handleChat(req,res){
  const ip=req.socket.remoteAddress||'unknown';if(!rateAllowed(ip)){sendJson(res,429,{error:'rate_limited'});return}
  if(!process.env.GROQ_API_KEY){sendJson(res,503,{error:'assistant_not_configured'});return}
  let body;try{body=await readJson(req)}catch(error){sendJson(res,error.message==='too_large'?413:400,{error:error.message});return}
  if(!Array.isArray(body.messages)||body.messages.length<1||body.messages.length>12){sendJson(res,400,{error:'invalid_messages'});return}
  const messages=body.messages.map(message=>({role:message?.role,content:String(message?.content||'').trim()}));
  if(messages.some(message=>!['user','assistant'].includes(message.role)||!message.content||message.content.length>1200)||!messages.some(message=>message.role==='user')){sendJson(res,400,{error:'invalid_messages'});return}
  const system=`أنت مساعد خدمة العملاء الرسمي لشركة الركائز البشرية للاستقدام في السعودية. أجب بالعربية الواضحة وباختصار، وافهم اللهجات العربية. معلومات الشركة: البريد info@alrkayzb2.com. أرقام خدمة العملاء والواتساب: رهام +966565914447، راضي +966506207444، مها +966559720444، خلود +966554834447، سليمان +966573994447، أذاد +966537914445، نوف +966556535444، أشواق +966573694447، وجدان +966573904447، أنفال +966579224447. أسعار التأجير الشهرية الظاهرة: كينيا 1800 ريال، بوروندي 1800 ريال، بنغلاديش 2200 ريال، إثيوبيا 1800 ريال، أوغندا 1800 ريال، إندونيسيا 3200 ريال. الصورة لا تحدد إجمالي الشهرين أو 3 أشهر، فلا تخمنه. أسعار الاستقدام الظاهرة: بنغلاديش 6999 ريال، كينيا 5599 ريال، أوغندا 4499 ريال، سريلانكا 14499 ريال. لا تخترع الأسعار أو مدة التنفيذ أو أوقات الدوام أو تفاصيل السياسات؛ إذا لم تكن المعلومة في سياق المحادثة فقل إن فريق خدمة العملاء يؤكدها، واذكر رقم الهاتف. إذا وصف العميل مشكلة أو طلب تقديم شكوى، وجّهه لاختيار «تقديم شكوى» داخل المحادثة حتى نسجل التفاصيل ورقم الهاتف ويتواصل معه الفريق. لا تطلب بيانات حساسة أو مستندات. لا تدّع أنك سجلت شكوى ما لم تؤكد الواجهة تسجيلها.`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',messages:[{role:'system',content:system},...messages],temperature:.35,max_completion_tokens:350}),signal:controller.signal});
    if(!response.ok){console.error('Groq API returned',response.status);sendJson(res,502,{error:'assistant_unavailable'});return}
    const result=await response.json(),reply=result.choices?.[0]?.message?.content?.trim();if(!reply){sendJson(res,502,{error:'empty_reply'});return}sendJson(res,200,{reply});
  }catch(error){console.error('Chat completion failed',error.name==='AbortError'?'timeout':error.message);sendJson(res,502,{error:'assistant_unavailable'})}finally{clearTimeout(timer)}
}

http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:8765');
  if(req.method==='POST'&&url.pathname==='/api/chat'){await handleChat(req,res);return}
  if(req.method==='POST'&&url.pathname==='/save'){
    const name=url.searchParams.get('name');if(!/^al-rakaez-brand-film\.(mp4|webm)$/.test(name||'')){res.writeHead(400);res.end('Invalid output name');return}
    const target=path.join(outputDir,name);const stream=fs.createWriteStream(target);let size=0;
    req.on('data',chunk=>{size+=chunk.length;if(size>120*1024*1024){req.destroy();stream.destroy()}});
    req.pipe(stream);stream.on('finish',()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({saved:name,size}))});
    stream.on('error',()=>{res.writeHead(500);res.end('Write failed')});return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end('Method not allowed');return}
  let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{res.writeHead(400);res.end('Invalid path');return}
  if(pathname==='/')pathname='/index.html';
  const segments=pathname.split('/').filter(Boolean);if(segments.some(segment=>segment.startsWith('.'))){res.writeHead(404);res.end('Not found');return}
  const target=path.resolve(root,'.'+pathname);
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}
  fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data)});
}).listen(Number(process.env.PORT)||8765,process.env.HOST||'127.0.0.1',()=>console.log(`Rakaez server ready at http://${process.env.HOST||'127.0.0.1'}:${Number(process.env.PORT)||8765}/`));


