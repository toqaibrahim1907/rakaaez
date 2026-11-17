import {authorize,db,errorResponse,log,sameOrigin} from '../../lib/server';
import {permissions} from '../../lib/model';
export async function POST(request:Request){try{sameOrigin(request);const user=await authorize('access.write');const body=await request.json() as any;
 if(body.type==='role'){
  if(body.id==='manager')throw new Error('صلاحيات المدير ثابتة');
  if(!/^[a-z][a-z0-9_-]{1,40}$/.test(body.id)||typeof body.name!=='string'||!body.name.trim()||body.name.length>80||!Array.isArray(body.permissions)||body.permissions.some((p:string)=>!permissions.includes(p)||p==='access.write'||p==='evaluations.write'))throw new Error('بيانات دور غير صحيحة؛ إدارة الصلاحيات والتقييم للمدير فقط');
  await db().prepare('INSERT INTO roles VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,permissions=excluded.permissions').bind(body.id,body.name.trim(),JSON.stringify(body.permissions)).run();
 }else if(body.type==='member'){
  const email=String(body.email).trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('بريد غير صحيح');if(email===user.email)throw new Error('لا يمكنك تغيير دورك بنفسك');
  if(!await db().prepare('SELECT id FROM roles WHERE id=?').bind(body.roleId).first())throw new Error('دور غير موجود');
  await db().prepare('INSERT INTO members VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET role_id=excluded.role_id').bind(email,body.roleId,new Date().toISOString()).run();
 }else if(body.type==='remove'){
  if(body.email===user.email)throw new Error('لا يمكنك إزالة نفسك');await db().prepare('DELETE FROM members WHERE email=?').bind(body.email).run();
 }else throw new Error('طلب غير صحيح');await log(user.email,'access',body.id||body.email);return Response.json({ok:true});}catch(e){return errorResponse(e);}}
