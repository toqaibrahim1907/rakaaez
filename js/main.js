const ADMIN_STORAGE_KEY='rakaez-admin-prototype-v1';
const backend=window.RakaezBackend;

function readAdminData(){try{return JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY)||'{}')}catch{return {}}}
function htmlEscape(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function getPublicWorkers(){
  const saved=readAdminData();
  if(Array.isArray(saved.workers))return saved.workers.filter(worker=>worker.cvId&&worker.publication==='منشورة'&&worker.availability==='متاحة').map(worker=>({ref:worker.ref,name:worker.name,photoUrl:worker.photoUrl,nationality:worker.nationality,profession:worker.profession,service:worker.service,status:worker.availability,age:worker.age,experience:worker.experience,totalRecruitmentCost:worker.totalRecruitmentCost,languages:worker.languages,skills:worker.skills}));
  return [];
}
function workerCard(worker){
  const text=encodeURIComponent(`السلام عليكم، أرغب في الاستفسار عن البطاقة ${worker.ref}.`);
  const details=[worker.age&&['العمر',worker.age],worker.experience&&['الخبرة',worker.experience]].filter(Boolean).map(([label,value])=>`<div><small>${label}</small><span>${htmlEscape(value)}</span></div>`).join('');
  const price=Number(worker.totalRecruitmentCost),priceText=worker.totalRecruitmentCost!==''&&worker.totalRecruitmentCost!=null&&Number.isFinite(price)?new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR',maximumFractionDigits:0}).format(price):'';
  const photo=worker.photoUrl?`<img class="worker-portrait" src="${htmlEscape(worker.photoUrl)}" alt="صورة ${htmlEscape(worker.name||'العاملة')}" loading="lazy">`:'<span class="worker-avatar" aria-hidden="true">✦</span>';
  return `<div class="col-md-6 col-lg-4"><article class="worker-card"><div class="worker-photo">${photo}<span class="demo-tag">متاحة</span></div><div class="worker-body"><span class="worker-ref">رقم مرجعي: ${htmlEscape(worker.ref)}</span><h3>${htmlEscape(worker.name||'ملف مرشح')}</h3><div class="worker-meta"><span>${htmlEscape(worker.nationality)}</span><span>${htmlEscape(worker.profession)}</span><span>${htmlEscape(worker.service)}</span></div>${details?`<div class="worker-profile-details">${details}</div>`:''}${priceText?`<div class="worker-price"><small>إجمالي سعر الاستقدام</small><strong>${htmlEscape(priceText)}</strong></div>`:''}<div class="worker-cta"><span>ملف مختصر</span><a href="https://wa.me/966920016419?text=${text}" target="_blank" rel="noopener">استفسر عبر واتساب ↗</a></div></div></article></div>`;
}
function applyCmsImages(publishedImages){
  if(backend?.ready&&!publishedImages)return;
  const images=publishedImages||readAdminData().cms?.images||{};
  if(images.hero){const hero=document.querySelector('.hero-image');if(hero){const apply=()=>{const mobile=window.matchMedia('(max-width: 767px)').matches,overlay=mobile?'linear-gradient(0deg,rgba(13,37,54,.97) 0%,rgba(13,37,54,.82) 50%,rgba(13,37,54,.08) 100%)':'linear-gradient(270deg,rgba(13,37,54,.93) 0%,rgba(13,37,54,.83) 34%,rgba(13,37,54,.32) 72%,rgba(13,37,54,.05) 100%)';hero.style.backgroundImage=`${overlay},url("${images.hero}")`};apply();window.addEventListener('resize',apply)}}
  if(images.about)document.querySelectorAll('.about-visual img,.visual-frame img').forEach(image=>image.src=images.about);
  const hero=document.querySelector('.hero-image');if(hero&&images.video){let video=hero.querySelector('.hero-video');if(!video){video=document.createElement('video');video.className='hero-video';video.autoplay=true;video.muted=true;video.loop=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-hidden','true');hero.append(video)}if(video.src!==images.video)video.src=images.video;hero.classList.add('has-video');video.play().catch(()=>{})}else if(hero){hero.querySelector('.hero-video')?.remove();hero.classList.remove('has-video')}
}
applyCmsImages();

async function loadPublishedContent(){if(!backend?.ready)return;try{const [workerResult,contentResult]=await Promise.all([backend.client.from('published_workers').select('ref,name,photo_path,nationality,profession,service,availability,age,experience,total_recruitment_cost,languages,skills'),backend.client.from('site_content').select('headline,subhead,images,sections').eq('id',1).eq('published',true).maybeSingle()]);if(!workerResult.error&&workerResult.data){publicWorkers=await Promise.all(workerResult.data.map(async worker=>{let photoUrl='';if(worker.photo_path){const {data,error}=await backend.client.storage.from('worker-photos').download(worker.photo_path);if(!error&&data)photoUrl=URL.createObjectURL(data)}return {...worker,photoUrl,status:worker.availability,totalRecruitmentCost:worker.total_recruitment_cost}}));renderFeaturedWorkers();refreshPublicWorkers()}if(!contentResult.error&&contentResult.data){const content=contentResult.data;if(content.images)applyCmsImages(content.images);const title=document.querySelector('.hero-copy h1'),description=document.querySelector('.hero-copy p');if(title&&content.headline)title.textContent=content.headline;if(description&&content.subhead)description.textContent=content.subhead;for(const section of content.sections||[]){const node=document.querySelector(`[data-public-section="${CSS.escape(section.key||section)}"]`);if(node&&typeof section==='object')node.hidden=section.visible===false}}if(requestForm){const note=document.querySelector('.form-note'),submit=requestForm.querySelector('[type="submit"]');if(note)note.textContent='سيصل طلبك مباشرة إلى فريق الشركة لمتابعته.';if(submit)submit.textContent='إرسال الطلب ←'}}catch(error){console.error('Public Supabase query failed',error)}}
loadPublishedContent();

let publicWorkers=getPublicWorkers();
let refreshPublicWorkers=()=>{};
const featured=document.querySelector('#featuredWorkers');
function renderFeaturedWorkers(){if(featured)featured.innerHTML=publicWorkers.slice(0,3).map(workerCard).join('')||'<div class="col-12"><div class="preview-note">لا توجد ملفات متاحة منشورة حاليًا.</div></div>'}
renderFeaturedWorkers();
const workerResults=document.querySelector('#workerResults');
if(workerResults){
  const filters=['#workerSearch','#nationalityFilter','#professionFilter','#serviceFilter','#availabilityFilter'].map(selector=>document.querySelector(selector));
  function updateWorkers(){const [search,nation,profession,service,status]=filters.map(element=>element?.value.trim()||'');const matches=publicWorkers.filter(worker=>(!search||worker.ref.toLowerCase().includes(search.toLowerCase()))&&(!nation||worker.nationality===nation)&&(!profession||worker.profession===profession)&&(!service||worker.service===service)&&(!status||worker.status===status));workerResults.innerHTML=matches.length?matches.map(workerCard).join(''):'<div class="col-12"><div class="filter-panel text-center py-5 text-secondary">لا توجد بطاقات تطابق خيارات البحث.</div></div>'}
  refreshPublicWorkers=updateWorkers;filters.forEach(element=>element?.addEventListener('input',updateWorkers));filters.forEach(element=>element?.addEventListener('change',updateWorkers));updateWorkers();
}
window.addEventListener('storage',event=>{if(event.key!==ADMIN_STORAGE_KEY||backend?.ready)return;applyCmsImages();publicWorkers=getPublicWorkers();renderFeaturedWorkers();refreshPublicWorkers()});

const requestForm=document.querySelector('#requestForm');
if(requestForm){
    requestForm.addEventListener('submit',async event=>{
    event.preventDefault();if(!requestForm.reportValidity())return;
    const values=Object.fromEntries(new FormData(requestForm));
      if(backend?.ready){const id=`RQ-${Date.now().toString().slice(-6)}`,payload={id,customer_name:values.name,mobile:values.mobile,service:values.service==='rental'?'التأجير':'الاستقدام',nationality:values.nationality||'',profession:values.profession||'',notes:values.notes||''};const {error}=await backend.client.from('customer_requests').insert(payload);const message=document.querySelector('#formMessage');if(error){message.className='form-message show error';message.textContent='تعذر إرسال الطلب الآن. يرجى المحاولة مجددًا أو التواصل عبر الهاتف.';return}message.className='form-message show success';message.textContent=`تم استلام طلبك بنجاح. رقم المتابعة ${id}.`;requestForm.reset();return}
    const data=readAdminData();if(!Array.isArray(data.requests))data.requests=[];
    const id=`RQ-${Date.now().toString().slice(-6)}`;
    data.requests.unshift({id,name:values.name,mobile:values.mobile,service:values.service==='rental'?'التأجير':'الاستقدام',preference:[values.nationality||'بدون تفضيل',values.profession||'المهنة غير محددة'].join(' · '),date:new Date().toLocaleString('ar-SA'),status:'لم يتم التواصل',assignee:'غير معين',notes:values.notes||''});
    try{localStorage.setItem(ADMIN_STORAGE_KEY,JSON.stringify(data));const message=document.querySelector('#formMessage');message.className='form-message show success';message.textContent=`تم حفظ الطلب ${id} في هذا المتصفح وسيظهر في لوحة الإدارة المحلية. لم يتم إرساله إلى خادم الشركة.`;requestForm.reset()}catch{const message=document.querySelector('#formMessage');message.className='form-message show error';message.textContent='تعذر حفظ الطلب محليًا. لم يتم إرساله إلى خادم الشركة.'}
  });
}
