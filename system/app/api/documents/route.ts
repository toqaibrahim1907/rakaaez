import {authorize,db,bucket,errorResponse,log,sameOrigin} from '../../lib/server';
export async function POST(request:Request){try{sameOrigin(request);const user=await authorize('documents.write');const form=await request.formData();const file=form.get('file');const workerId=String(form.get('workerId'));const category=String(form.get('category')||'cv');
 if(!(file instanceof File)||file.size===0||file.size>10*1024*1024)throw new Error('أرفق ملفاً حتى 10 ميجابايت');if(!['cv','residency'].includes(category))throw new Error('تصنيف غير صحيح');
 if(!await db().prepare("SELECT id FROM records WHERE id=? AND kind='workers'").bind(workerId).first())throw new Error('العاملة غير موجودة');
 const bytes=new Uint8Array(await file.arrayBuffer());const ext=file.name.split('.').pop()?.toLowerCase();
 const isPdf=ext==='pdf'&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
 const isDoc=ext==='doc'&&[208,207,17,224,161,177,26,225].every((b,i)=>bytes[i]===b);
 const isDocx=ext==='docx'&&bytes[0]===80&&bytes[1]===75&&new TextDecoder().decode(bytes).includes('word/');
 if(!isPdf&&!isDoc&&!isDocx)throw new Error('يدعم PDF وWord فقط، ويجب أن يطابق الملف نوعه');
 const mime=isPdf?'application/pdf':isDoc?'application/msword':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';const id=crypto.randomUUID();
 await bucket().put(id,bytes,{httpMetadata:{contentType:mime}});
 try{await db().prepare('INSERT INTO documents VALUES (?,?,?,?,?,?,?,?)').bind(id,workerId,category,file.name.slice(0,200),mime,file.size,new Date().toISOString()).run();}catch(e){await bucket().delete(id);throw e;}
 await log(user.email,'upload',id);return Response.json({ok:true});}catch(e){return errorResponse(e);}}
export async function GET(request:Request){try{await authorize('documents.read');const url=new URL(request.url);const id=url.searchParams.get('id');const doc=await db().prepare('SELECT * FROM documents WHERE id=?').bind(id).first<any>();if(!doc)throw new Error('404');const object=await bucket().get(doc.id);if(!object)throw new Error('404');const inline=doc.mime==='application/pdf'&&url.searchParams.get('preview')==='1';return new Response(object.body,{headers:{'Content-Type':doc.mime,'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox"}});}catch(e){return errorResponse(e);}}
export async function DELETE(request:Request){try{sameOrigin(request);const user=await authorize('documents.write');const {id}=await request.json() as any;await db().prepare('DELETE FROM documents WHERE id=?').bind(id).run();await bucket().delete(id);await log(user.email,'delete-document',id);return Response.json({ok:true});}catch(e){return errorResponse(e);}}
