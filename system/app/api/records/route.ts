import {authorize,db,allRecords,errorResponse,log,sameOrigin} from '../../lib/server';
import {fields,Kind} from '../../lib/model';
export async function POST(request:Request){try{
 sameOrigin(request);const body=await request.json() as any; const {kind,id,version,action}=body;
 if(![...Object.keys(fields),'settings','payments'].includes(kind))throw new Error('نوع سجل غير صالح');
 const user=await authorize(`${kind==='payments'?'salaries':kind}.write`);
 if(kind==='evaluations'&&user.role!=='manager')throw new Error('403');
 const records=await allRecords();const old=records.find(r=>r.id===id&&r.kind===kind); const now=new Date().toISOString();
 if(action==='delete'){
  if(!old)throw new Error('404');if(kind==='payments')throw new Error('سجل الدفعات محفوظ ولا يحذف');
  if(records.some(r=>r.id!==id&&Object.entries(r.data).some(([k,v])=>k.endsWith('Id')&&v===id))||(await db().prepare('SELECT id FROM documents WHERE worker_id=?').bind(id).first()))throw new Error('السجل مرتبط بسجلات أخرى. احفظ التاريخ أو أرشف العاملة بدلاً من الحذف');
  const result=await db().prepare('DELETE FROM records WHERE id=? AND version=?').bind(id,version).run();if(!result.meta.changes)throw new Error('409');
 }else{
  let data:Record<string,any>={};
  if(kind==='settings'){
   data={name:'إعدادات التأجير',salaryMode:'manual'};
   const statuses=body.data.contractStatuses;if(!Array.isArray(statuses)||statuses.length<1||statuses.length>20||statuses.some((s:any)=>typeof s!=='string'||!s.trim()||s.length>60)||new Set(statuses).size!==statuses.length)throw new Error('أدخل حالات فريدة وصحيحة');
   if(records.some(r=>r.kind==='contracts'&&!statuses.includes(r.data.status)))throw new Error('لا يمكن إزالة حالة مستخدمة في عقد');
   data.contractStatuses=statuses; const window=Number(body.data.soonDays);if(!Number.isInteger(window)||window<0||window>365)throw new Error('نافذة العرض من 0 إلى 365 يوماً');data.soonDays=window;
  }else if(kind==='payments'){
   if(old)throw new Error('الدفعات غير قابلة للتعديل');const salary=records.find(r=>r.id===body.data.salaryId&&r.kind==='salaries');if(!salary)throw new Error('الاستحقاق غير موجود');
   if(salary.data.status==='موقوف')throw new Error('الاستحقاق موقوف');
   data={salaryId:salary.id,amount:body.data.amount,date:body.data.date,reference:String(body.data.reference||'').slice(0,200),recordedBy:user.email};
   if(!Number.isSafeInteger(data.amount)||data.amount<=0||!/^\d{4}-\d{2}-\d{2}$/.test(data.date))throw new Error('أدخل مبلغاً موجباً وتاريخاً صحيحاً');
   const paymentId=id||crypto.randomUUID();
   const result=await db().prepare(`INSERT INTO records (id,kind,data,created_at,updated_at,version) SELECT ?, 'payments', ?, ?, ?, 1 WHERE EXISTS (SELECT 1 FROM records s WHERE s.id=? AND s.kind='salaries' AND json_extract(s.data,'$.status')!='موقوف' AND json_extract(s.data,'$.amount') >= ? + COALESCE((SELECT SUM(json_extract(p.data,'$.amount')) FROM records p WHERE p.kind='payments' AND json_extract(p.data,'$.salaryId')=s.id),0))`).bind(paymentId,JSON.stringify(data),now,now,salary.id,data.amount).run();
   if(!result.meta.changes)throw new Error('المبلغ يتجاوز المتبقي أو تم إيقاف الاستحقاق');await log(user.email,'payment',paymentId);return Response.json({ok:true});
  }else{
   for(const f of fields[kind as Kind]){
    let value=body.data?.[f.key]??'';
    if(f.required&&(value===''||value===null))throw new Error(`الحقل مطلوب: ${f.label}`);
    if(value!==''&&(f.type==='money'||f.type==='number')){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error(`قيمة غير صحيحة: ${f.label}`);}
    else {if(typeof value!=='string'||value.length>4000)throw new Error(`قيمة غير صحيحة: ${f.label}`);value=value.trim();if(f.required&&!value)throw new Error(`الحقل مطلوب: ${f.label}`);}
    if(f.type==='date'&&value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))))throw new Error('تاريخ غير صحيح');
    const options=kind==='contracts'&&f.key==='status'?(records.find(r=>r.kind==='settings')?.data.contractStatuses||f.options):f.options;
    if(options&&value&&!options.includes(value))throw new Error('حالة غير صالحة');
    if(f.ref&&value&&!records.some(r=>r.kind===f.ref&&r.id===value))throw new Error('السجل المرتبط غير موجود');data[f.key]=value;
   }
   if(kind==='workers')data.archived=Boolean(body.data.archived);
   if(kind==='contracts'){
    if(data.end<data.start)throw new Error('تاريخ النهاية يسبق البداية');
    if(records.some(r=>r.kind==='contracts'&&r.id!==id&&r.data.number===data.number))throw new Error('رقم العقد مستخدم');
   }
   if(kind==='salaries'&&old){const paid=records.filter(r=>r.kind==='payments'&&r.data.salaryId===id).reduce((sum,r)=>sum+r.data.amount,0);if(data.amount<paid)throw new Error('المبلغ أقل من الدفعات المسجلة');if(paid>0&&(old.data.workerId!==data.workerId||old.data.period!==data.period))throw new Error('لا يمكن تغيير العاملة أو الفترة بعد الدفع');}
   if(kind==='evaluations')data.evaluator=user.email;
  }
  if(id&&!old)throw new Error('404');
  if(old){const result=await db().prepare('UPDATE records SET data=?, updated_at=?, version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(data),now,id,version).run();if(!result.meta.changes)throw new Error('409');}
  else {if(kind==='settings'&&records.some(r=>r.kind==='settings'))throw new Error('409');await db().prepare('INSERT INTO records (id,kind,data,created_at,updated_at,version) VALUES (?,?,?,?,?,1)').bind(crypto.randomUUID(),kind,JSON.stringify(data),now,now).run();}
 }
 await log(user.email,action==='delete'?'delete':old?'update':'create',id||kind);return Response.json({ok:true});
 }catch(e){return errorResponse(e);}}
