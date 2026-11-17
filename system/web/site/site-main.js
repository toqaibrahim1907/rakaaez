const config = globalThis.RENTAL_CONFIG;
const client = config?.supabaseUrl && config?.supabasePublishableKey && globalThis.supabase ? globalThis.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
let site = null;
if (client) {
  const result = await client.from('website_published_content').select('organization_id,headline,subhead,images').limit(2);
  if (!result.error && result.data?.length === 1) site = result.data[0];
}
if (site) {
  const title = document.querySelector('.hero-copy h1'), description = document.querySelector('.hero-copy > p');
  if (title && site.headline) title.textContent = site.headline;
  if (description && site.subhead) description.textContent = site.subhead;
  const hero = document.querySelector('.hero-image');
  if (hero && site.images?.hero) {
    const image = await client.storage.from('website-site-media').createSignedUrl(site.images.hero, 120);
    if (!image.error && image.data?.signedUrl) hero.style.backgroundImage = `linear-gradient(270deg,rgba(13,37,54,.93),rgba(13,37,54,.05)),url(${JSON.stringify(image.data.signedUrl)})`;
  }
}
const requestForm = document.querySelector('#requestForm');
if (requestForm) {
  const button = requestForm.querySelector('[type=submit]'), message = document.querySelector('#formMessage');
  if (!site) { button.disabled = true; message.className = 'form-message show error'; message.textContent = 'استقبال الطلبات غير متاح حالياً.'; }
  else requestForm.addEventListener('submit', async event => {
    event.preventDefault(); if (!requestForm.reportValidity()) return;
    button.disabled = true; const values = new FormData(requestForm);
    const details = [values.get('nationality') && `الجنسية: ${values.get('nationality')}`, values.get('profession') && `المهنة: ${values.get('profession')}`, values.get('rentalDuration') && `المدة: ${values.get('rentalDuration')}`, values.get('notes')].filter(Boolean).join(' · ');
    try {
      if (details.length > 1000) throw new Error('تفاصيل الطلب طويلة أكثر من اللازم.');
      const {data,error} = await client.rpc('submit_website_request',{p_name:values.get('name'),p_mobile:values.get('mobile'),p_service:values.get('service') === 'rental' ? 'التأجير' : 'الاستقدام',p_notes:details});
      if (error) throw error; message.className='form-message show success'; message.textContent=`تم الإرسال بنجاح. رقم المتابعة: ${data}`; requestForm.reset();
    } catch (error) { message.className='form-message show error'; message.textContent=error.code === '53300' ? 'تم الوصول لحد الإرسال. يرجى المحاولة لاحقاً.' : error.message === 'تفاصيل الطلب طويلة أكثر من اللازم.' ? error.message : 'تعذر إرسال الطلب حالياً. حاولي لاحقاً.'; }
    finally {button.disabled=false;}
  });
}
const complaint = document.querySelector('#complaintForm');
if (complaint) {
  const button=complaint.querySelector('[type=submit]'), message=document.querySelector('#complaintMessage');
  if (!site) { button.disabled=true; message.textContent='استقبال الشكاوى غير متاح حالياً.'; }
  else complaint.addEventListener('submit',async event => {
    event.preventDefault(); if (!complaint.reportValidity()) return; button.disabled=true;
    try { const values=new FormData(complaint), {data,error}=await client.rpc('submit_website_complaint',{p_phone:values.get('phone'),p_text:values.get('text')}); if(error) throw error; complaint.reset(); message.textContent=`تم الإرسال بنجاح. رقم المتابعة: ${data}`; }
    catch (error) { message.textContent=error.code === '53300' ? 'تم الوصول لحد الإرسال. يرجى المحاولة لاحقاً.' : 'تعذر إرسال الشكوى حالياً. حاولي لاحقاً.'; } finally {button.disabled=false;}
  });
}
const results=document.querySelector('#workerResults'), featured=document.querySelector('#featuredWorkers');
if (results || featured) {
  let workers=[];
  if (site) { const response=await client.from('website_published_workers').select('ref,nationality,profession,service,age,experience,photo_path').eq('organization_id',site.organization_id).limit(100); if(!response.error) workers=response.data || []; }
  const filters=['workerSearch','nationalityFilter','professionFilter','serviceFilter','availabilityFilter'].map(id=>document.getElementById(id));
  async function card(worker) {
    const column=document.createElement('div'); column.className='col-md-6 col-lg-4';
    const article=document.createElement('article'); article.className='worker-card';
    const photo=document.createElement('div'); photo.className='worker-photo';
    if (worker.photo_path) { const signed=await client.storage.from('website-worker-photos').createSignedUrl(worker.photo_path,120); if(!signed.error && signed.data?.signedUrl){const image=document.createElement('img'); image.className='worker-portrait'; image.src=signed.data.signedUrl; image.alt='صورة بطاقة العاملة'; image.loading='lazy'; image.referrerPolicy='no-referrer'; photo.append(image);} }
    const body=document.createElement('div'); body.className='worker-body';
    const heading=document.createElement('h3'); heading.textContent=worker.profession || 'عاملة منزلية'; body.append(heading);
    const meta=document.createElement('p'); meta.textContent=[worker.ref,worker.nationality,worker.service,worker.age,worker.experience].filter(Boolean).join(' · '); body.append(meta);
    const link=document.createElement('a'); link.className='worker-order-button'; link.href='request.html'; link.textContent='اطلب الخدمة ←'; body.append(link); article.append(photo,body); column.append(article); return column;
  }
  let sequence=0;
  async function render() {
    const current=++sequence, [search,nation,profession,service,status]=filters.map(el=>el?.value.trim() || '');
    const matches=workers.filter(w=>(!search || w.ref.toLowerCase().includes(search.toLowerCase())) && (!nation || w.nationality===nation) && (!profession || w.profession===profession) && (!service || w.service===service) && (!status || status==='متاحة'));
    for(const target of [results,featured].filter(Boolean)) { const selected=target===featured ? matches.slice(0,3) : matches; const cards=await Promise.all(selected.map(card)); if(current!==sequence) return; if(cards.length) target.replaceChildren(...cards); else {const empty=document.createElement('p');empty.className='text-secondary';empty.textContent='لا توجد بطاقات متاحة حالياً.';target.replaceChildren(empty);} }
  }
  filters.filter(Boolean).forEach(field=>field.addEventListener('input',render)); await render();
}

