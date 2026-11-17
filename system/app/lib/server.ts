import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../chatgpt-auth';
import { permissions } from './model';
export const db = () => { if(!env.DB) throw new Error('Database unavailable'); return env.DB; };
export const bucket = () => { if(!env.BUCKET) throw new Error('File storage unavailable'); return env.BUCKET; };
export async function identity(){
 const user=await getChatGPTUser(); if(!user) throw new Error('401');
 const email=user.email.toLowerCase();
 // Initial site is owner-private: only the authenticated owner can initialize it.
 await db().batch([
  db().prepare('INSERT OR IGNORE INTO roles (id,name,permissions) VALUES (?,?,?)').bind('manager','مدير',JSON.stringify(permissions)),
  db().prepare('INSERT OR IGNORE INTO roles (id,name,permissions) VALUES (?,?,?)').bind('employee','موظف','[]'),
 ]);
 await db().prepare("INSERT OR IGNORE INTO members (email,role_id,created_at) SELECT ?, 'manager', ? WHERE NOT EXISTS (SELECT 1 FROM members)").bind(email,new Date().toISOString()).run();
 const member=await db().prepare('SELECT roles.* FROM members JOIN roles ON roles.id=members.role_id WHERE members.email=?').bind(email).first<any>();
 return {...user, email, role:member?.id||null, permissions:member?JSON.parse(member.permissions):[]};
}
export async function authorize(permission:string){const user=await identity();if(!user.permissions.includes(permission)) throw new Error('403');return user;}
export function errorResponse(e:unknown){const message=e instanceof Error?e.message:'Unknown error'; const status=['401','403','404','409'].includes(message)?Number(message):400;return Response.json({error:({401:'يرجى تسجيل الدخول',403:'ليس لديك صلاحية',404:'السجل غير موجود',409:'تم تعديل السجل. حدّث الصفحة وحاول مجدداً'} as any)[status]||message},{status});}
export async function log(actor:string,action:string,entity:string){await db().prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,entity,new Date().toISOString()).run();}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin && origin!==new URL(request.url).origin)throw new Error('403');}
export async function allRecords(){const {results}=await db().prepare('SELECT * FROM records ORDER BY created_at DESC').all<any>();return results.map(r=>({...r,data:JSON.parse(r.data)}));}
