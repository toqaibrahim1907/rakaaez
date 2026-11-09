const ADMIN_STORAGE_KEY = 'rakaez-admin-prototype-v1';
const backend = window.RakaezBackend;

function readAdminData() { try { return JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || '{}') } catch { return {} } }
const SITE_THEMES = ['sky-light', 'sky-dark', 'cyan-light', 'cyan-dark', 'ocean-light', 'teal-light', 'indigo-light', 'blue-gold-light'];
function applyCmsTheme(theme) { const selected = SITE_THEMES.includes(theme) ? theme : 'sky-light'; document.documentElement.dataset.siteTheme = selected; document.body.dataset.siteTheme = selected }
applyCmsTheme(readAdminData().cms?.theme);
function htmlEscape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) }
function getPublicWorkers() {
  const saved = readAdminData();
  if (Array.isArray(saved.workers)) return saved.workers.filter(worker => worker.cvId && worker.publication === 'منشورة' && worker.availability === 'متاحة').map(worker => ({ ref: worker.ref, name: worker.name, photoUrl: worker.photoUrl, cvPath: worker.cvPath, cvFileName: worker.cvFileName, nationality: worker.nationality, profession: worker.profession, service: worker.service, status: worker.availability, age: worker.age, experience: worker.experience, totalRecruitmentCost: worker.totalRecruitmentCost, languages: worker.languages, skills: worker.skills }));
  return [];
}
function workerCard(worker) {
  const details = [worker.age && ['العمر', worker.age], worker.experience && ['الخبرة', worker.experience]].filter(Boolean).map(([label, value]) => `<div><small>${label}</small><span>${htmlEscape(value)}</span></div>`).join('');
  const price = Number(worker.totalRecruitmentCost), priceText = worker.totalRecruitmentCost !== '' && worker.totalRecruitmentCost != null && Number.isFinite(price) ? new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(price) : '';
  const photo = worker.photoUrl ? `<img class="worker-portrait" src="${htmlEscape(worker.photoUrl)}" alt="صورة ${htmlEscape(worker.name || 'العاملة')}" loading="lazy">` : '<span class="worker-avatar" aria-hidden="true">✦</span>';
  const priceLabel = worker.service === 'التأجير' ? 'سعر التأجير الشهري' : 'إجمالي سعر الاستقدام';
  return `<div class="col-md-6 col-lg-4"><article class="worker-card"><div class="worker-photo">${photo}<span class="demo-tag">متاحة</span><span class="worker-photo-ref">${htmlEscape(worker.ref)}</span></div><div class="worker-body"><div class="worker-card-heading"><span class="worker-card-kicker">ملف عاملة منزلية</span><h3>${htmlEscape(worker.name || 'ملف مرشحة')}</h3></div><div class="worker-meta"><span>${htmlEscape(worker.nationality)}</span><span>${htmlEscape(worker.profession)}</span><span>${htmlEscape(worker.service)}</span></div>${details ? `<div class="worker-profile-details">${details}</div>` : ''}${priceText ? `<div class="worker-price"><small>${priceLabel}</small><strong>${htmlEscape(priceText)}</strong></div>` : ''}<button class="worker-order-button" type="button" data-worker-order="${htmlEscape(worker.ref)}">اطلب العاملة <span aria-hidden="true">←</span></button></div></article></div>`;
}
function applyCmsSectionImages(images = {}) { const setImage = (key, selector, position = 'append') => { const imageUrl = images[key], target = document.querySelector(selector); if (!imageUrl || !target) return; let image = target.querySelector(`[data-cms-managed-image="${key}"]`); if (!image) { image = document.createElement('img'); image.dataset.cmsManagedImage = key; image.className = 'cms-managed-image'; image.alt = ''; image.loading = 'lazy'; if (position === 'prepend') target.prepend(image); else target.append(image) } image.src = imageUrl }; setImage('servicesRental', '.rental-panel', 'prepend'); setImage('servicesRecruitment', '.recruit-panel', 'prepend'); setImage('workers', '.workers-preview .container', 'prepend'); const card = document.querySelector('.promise-card'); if (card) { if (images.cta) card.style.backgroundImage = `linear-gradient(105deg,rgba(11,103,158,.87),rgba(16,47,77,.9)),url("${images.cta}")`; else card.style.removeProperty('background-image') } }
function applyCmsSectionContent(sections = []) { const get = key => sections.find(item => item && typeof item === 'object' && item.key === key)?.content || {}; const set = (selector, value) => { const node = document.querySelector(selector); if (node && value) node.textContent = value }; const hero = get('hero'), about = get('about'), services = get('services'), workers = get('workers'), cta = get('cta'); set('.hero-copy>.eyebrow', hero.eyebrow); set('.hero-copy h1', hero.title); set('.hero-copy>p', hero.description); set('.about-teaser .eyebrow', about.eyebrow); set('.about-teaser .display-title', about.title); set('.about-teaser .body-copy', about.description); set('.service-switch .section-heading .eyebrow', services.eyebrow); set('.service-switch .section-heading h2', services.title); set('.service-switch .section-heading p', services.description); set('.rental-panel h3', services.rentalTitle); set('.rental-panel p', services.rentalDescription); set('.recruit-panel h3', services.recruitmentTitle); set('.recruit-panel p', services.recruitmentDescription); set('.workers-preview .section-head-row .eyebrow', workers.eyebrow); set('.workers-preview .section-head-row h2', workers.title); set('.workers-preview .section-head-row p', workers.description); set('.promise-card .eyebrow', cta.eyebrow); set('.promise-card h2', cta.title); set('.promise-card p', cta.description); set('.promise-card a.btn', cta.buttonLabel); const reviews = get('testimonials'); set('[data-reviews-eyebrow]', reviews.eyebrow); set('[data-reviews-title]', reviews.title); set('[data-reviews-description]', reviews.description) }
function applyCmsSectionOrder(sections = []) { const main = document.querySelector('main'); if (!main) return; const nodes = [...main.querySelectorAll(':scope > [data-public-section]')]; if (!nodes.length) return; const keys = sections.map(section => typeof section === 'string' ? section : section?.key).filter(key => nodes.some(node => node.dataset.publicSection === key)); for (const node of nodes) if (!keys.includes(node.dataset.publicSection)) keys.push(node.dataset.publicSection); const marker = nodes[nodes.length - 1].nextSibling; const byKey = new Map(nodes.map(node => [node.dataset.publicSection, node])); const fragment = document.createDocumentFragment(); keys.forEach(key => { const node = byKey.get(key); if (node) fragment.append(node) }); main.insertBefore(fragment, marker) } function applyCmsImages(publishedImages) {
  if (backend?.ready && !publishedImages) return;
  const images = publishedImages || readAdminData().cms?.images || {};
  if (images.hero) { const hero = document.querySelector('.hero-image'); if (hero) { const apply = () => { const mobile = window.matchMedia('(max-width: 767px)').matches, overlay = mobile ? 'linear-gradient(0deg,rgba(13,37,54,.97) 0%,rgba(13,37,54,.82) 50%,rgba(13,37,54,.08) 100%)' : 'linear-gradient(270deg,rgba(13,37,54,.93) 0%,rgba(13,37,54,.83) 34%,rgba(13,37,54,.32) 72%,rgba(13,37,54,.05) 100%)'; hero.style.backgroundImage = `${overlay},url("${images.hero}")` }; apply(); window.addEventListener('resize', apply) } }
  if (images.about) document.querySelectorAll('.about-visual img,.visual-frame img').forEach(image => image.src = images.about); applyCmsSectionImages(images);
  const hero = document.querySelector('.hero-image'); if (hero && images.video) { let video = hero.querySelector('.hero-video'); if (!video) { video = document.createElement('video'); video.className = 'hero-video'; video.autoplay = true; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'metadata'; video.setAttribute('aria-hidden', 'true'); hero.append(video) } if (video.src !== images.video) video.src = images.video; hero.classList.add('has-video'); video.play().catch(() => { }) } else if (hero) { hero.querySelector('.hero-video')?.remove(); hero.classList.remove('has-video') }
}
applyCmsImages();

async function loadGoogleReviews() { const section = document.querySelector('[data-google-review-results]'); if (!section) return; try { const response = await fetch('/api/reviews', { headers: { Accept: 'application/json' } }), data = await response.json(); if (!response.ok) throw new Error(data.error || 'unavailable'); const summary = document.querySelector('[data-google-rating]'); if (summary && data.rating) { summary.hidden = false; summary.textContent = `${Number(data.rating).toFixed(1)} / 5 ★ · ${data.reviewCount} تقييم على Google` } const cards = data.reviews || []; if (cards.length) section.innerHTML = ''; for (const review of cards) { const article = document.createElement('article'); article.className = 'google-review-card'; const header = document.createElement('header'), author = document.createElement(review.authorUri ? 'a' : 'strong'); author.textContent = review.authorName || 'عميل Google'; if (review.authorUri) { author.href = review.authorUri; author.target = '_blank'; author.rel = 'noopener' } const brand = document.createElement('span'); brand.className = 'google-review-brand'; brand.setAttribute('aria-label', 'Google'); brand.textContent = 'G'; const stars = document.createElement('span'); stars.className = 'google-review-stars'; stars.setAttribute('aria-label', `${Math.max(0, Math.min(5, Math.round(review.rating || 0)))} من 5 نجوم`); stars.textContent = '★'.repeat(Math.max(0, Math.min(5, Math.round(review.rating || 0)))); header.append(author, brand); article.append(header, stars); if (review.text) { const body = document.createElement('p'); body.textContent = review.text; article.append(body) } const meta = document.createElement('small'); meta.textContent = review.publishTime ? new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(new Date(review.publishTime)) : 'مراجعة عميل على Google'; article.append(meta); section.append(article) } const link = document.querySelector('[data-google-reviews-link]'); if (link && data.mapsUrl) link.href = data.mapsUrl; if (!section.nextElementSibling?.classList.contains('google-attribution')) { const attribution = document.createElement('div'); attribution.className = 'google-attribution'; attribution.textContent = 'المصدر: Google Maps · تقييمات من صفحة الشركة الرسمية.'; section.after(attribution) } } catch (error) { /* Keep the official testimonials already in the page if live Google reviews are unavailable. */ } }
async function loadPublishedContent() {
  if (!backend?.ready) return; try {
    const [workerResult, contentResult] = await Promise.all([backend.client.from('published_workers').select('ref,name,photo_path,nationality,profession,service,availability,age,experience,total_recruitment_cost,languages,skills'), backend.client.from('site_content').select('headline,subhead,theme,images,sections,draft,published').eq('id', 1).maybeSingle()]); if (!workerResult.error && workerResult.data) { publicWorkers = await Promise.all(workerResult.data.map(async worker => { let photoUrl = ''; if (worker.photo_path) { const { data, error } = await backend.client.storage.from('worker-photos').download(worker.photo_path); if (!error && data) photoUrl = URL.createObjectURL(data) } return { ...worker, photoUrl, status: worker.availability, totalRecruitmentCost: worker.total_recruitment_cost } })); renderFeaturedWorkers(); refreshPublicWorkers() } if (!contentResult.error && contentResult.data) {
      const row = contentResult.data;
      // Only apply CMS content if the row is published; otherwise keep default HTML content
      if (!row.published) return;
      const content = row;
      // sections column: array of {key, visible, content} — use this as the source of truth
      // draft column may also have updated sections if admin saved a draft after last publish
      const rawSections = content.sections || [];
      applyCmsTheme(content.theme);
      if (content.images) { applyCmsImages(content.images); applyCmsSectionImages(content.images) }
      applyCmsSectionContent(rawSections);
      applyCmsSectionOrder(rawSections);
      for (const section of rawSections) { const key = typeof section === 'string' ? section : section.key, node = document.querySelector(`[data-public-section="${CSS.escape(key)}"]`); if (node && typeof section === 'object') node.hidden = section.visible === false }
      const title = document.querySelector('.hero-copy h1'), description = document.querySelector('.hero-copy>p'), heroContent = rawSections.find(s => s?.key === 'hero')?.content || {};
      if (title && heroContent.title) title.textContent = heroContent.title; else if (title && content.headline) title.textContent = content.headline;
      if (description && heroContent.description) description.textContent = heroContent.description; else if (description && content.subhead) description.textContent = content.subhead;
    } if (requestForm) { const note = document.querySelector('.form-note'), submit = requestForm.querySelector('[type="submit"]'); if (note) note.textContent = 'سيصل طلبك مباشرة إلى فريق الشركة لمتابعته.'; if (submit) submit.textContent = 'إرسال الطلب ←' }
  } catch (error) { console.error('Public Supabase query failed', error) }
}
loadPublishedContent(); loadGoogleReviews();

let publicWorkers = getPublicWorkers();
let refreshPublicWorkers = () => { };
const featured = document.querySelector('#featuredWorkers');
function renderFeaturedWorkers() { if (featured) featured.innerHTML = publicWorkers.slice(0, 3).map(workerCard).join('') || '<div class="col-12"><div class="preview-note">لا توجد ملفات متاحة منشورة حاليًا.</div></div>' }
renderFeaturedWorkers();
const workerResults = document.querySelector('#workerResults');
if (workerResults) {
  const filters = ['#workerSearch', '#nationalityFilter', '#professionFilter', '#serviceFilter', '#availabilityFilter'].map(selector => document.querySelector(selector));
  function updateWorkers() { const [search, nation, profession, service, status] = filters.map(element => element?.value.trim() || ''); const matches = publicWorkers.filter(worker => (!search || worker.ref.toLowerCase().includes(search.toLowerCase())) && (!nation || worker.nationality === nation) && (!profession || worker.profession === profession) && (!service || worker.service === service) && (!status || worker.status === status)); workerResults.innerHTML = matches.length ? matches.map(workerCard).join('') : '<div class="col-12"><div class="filter-panel text-center py-5 text-secondary">لا توجد بطاقات تطابق خيارات البحث.</div></div>' }
  refreshPublicWorkers = updateWorkers; filters.forEach(element => element?.addEventListener('input', updateWorkers)); filters.forEach(element => element?.addEventListener('change', updateWorkers)); updateWorkers();
}
window.addEventListener('storage', event => { if (event.key !== ADMIN_STORAGE_KEY || backend?.ready) return; const cms = readAdminData().cms || {}; applyCmsImages(); applyCmsTheme(cms.theme); applyCmsSectionContent(cms.sections || []); applyCmsSectionOrder(cms.sections || []); for (const item of cms.sections || []) { const key = item.key || item, node = document.querySelector(`[data-public-section="${CSS.escape(key)}"]`); if (node && typeof item === 'object') node.hidden = item.visible === false } publicWorkers = getPublicWorkers(); renderFeaturedWorkers(); refreshPublicWorkers() });

const requestForm = document.querySelector('#requestForm');
if (requestForm) {
  requestForm.addEventListener('submit', async event => {
    event.preventDefault(); if (!requestForm.reportValidity()) return;
    const values = Object.fromEntries(new FormData(requestForm));
    if (backend?.ready) { const id = `RQ-${Date.now().toString().slice(-6)}`, payload = { id, customer_name: values.name, mobile: values.mobile, service: values.service === 'rental' ? 'التأجير' : 'الاستقدام', nationality: values.nationality || '', profession: values.profession || '', notes: [values.rentalDuration ? 'مدة التأجير: ' + values.rentalDuration : '', values.notes || ''].filter(Boolean).join(' · ') }; const { error } = await backend.client.from('customer_requests').insert(payload); const message = document.querySelector('#formMessage'); if (error) { message.className = 'form-message show error'; message.textContent = 'تعذر إرسال الطلب الآن. يرجى المحاولة مجددًا أو التواصل عبر الهاتف.'; return } message.className = 'form-message show success'; message.textContent = `تم استلام طلبك بنجاح. رقم المتابعة ${id}.`; requestForm.reset(); return }
    const data = readAdminData(); if (!Array.isArray(data.requests)) data.requests = [];
    const id = `RQ-${Date.now().toString().slice(-6)}`;
    data.requests.unshift({ id, name: values.name, mobile: values.mobile, service: values.service === 'rental' ? 'التأجير' : 'الاستقدام', preference: [values.nationality || 'بدون تفضيل', values.profession || 'المهنة غير محددة'].join(' · '), date: new Date().toLocaleString('ar-SA'), status: 'لم يتم التواصل', assignee: 'غير معين', notes: [values.rentalDuration ? 'مدة التأجير: ' + values.rentalDuration : '', values.notes || ''].filter(Boolean).join(' · ') });
    try { localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data)); const message = document.querySelector('#formMessage'); message.className = 'form-message show success'; message.textContent = `تم حفظ الطلب ${id} في هذا المتصفح وسيظهر في لوحة الإدارة المحلية. لم يتم إرساله إلى خادم الشركة.`; requestForm.reset() } catch { const message = document.querySelector('#formMessage'); message.className = 'form-message show error'; message.textContent = 'تعذر حفظ الطلب محليًا. لم يتم إرساله إلى خادم الشركة.' }
  });
}

let activeWorkerOrder = null;
function getWorkerOrderModal() {
  let element = document.querySelector('#workerOrderModal');
  if (!element) {
    const host = document.createElement('div');
    host.innerHTML = `<div class="modal fade worker-order-modal" id="workerOrderModal" tabindex="-1" aria-labelledby="workerOrderTitle" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><div><span class="worker-order-eyebrow">طلب مباشر</span><h2 class="modal-title" id="workerOrderTitle">اطلب العاملة</h2></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="إغلاق"></button></div><div class="modal-body"><div class="worker-order-summary"><img data-worker-order-image alt=""><div><strong data-worker-order-name></strong><small data-worker-order-meta></small><span data-worker-order-ref></span></div></div><p class="worker-order-copy">اتركي بياناتك، وسيتواصل معك فريق الركائز البشرية لمتابعة الطلب.</p><form id="workerOrderForm"><label class="form-label" for="workerOrderCustomerName">الاسم</label><input class="form-control" id="workerOrderCustomerName" name="name" autocomplete="name" minlength="2" maxlength="100" required><label class="form-label mt-3" for="workerOrderCustomerPhone">رقم الجوال</label><input class="form-control" id="workerOrderCustomerPhone" name="mobile" type="tel" inputmode="tel" autocomplete="tel" minlength="8" maxlength="20" required><p class="form-message" id="workerOrderMessage" role="status" aria-live="polite"></p><button class="btn btn-primary worker-order-submit" type="submit">إرسال الطلب <span aria-hidden="true">←</span></button></form></div></div></div></div>`;
    document.body.append(host.firstElementChild);
    element = document.querySelector('#workerOrderModal');
  }
  return bootstrap.Modal.getOrCreateInstance(element);
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-worker-order]');
  if (!button) return;
  const worker = publicWorkers.find(item => item.ref === button.dataset.workerOrder);
  if (!worker) return;
  activeWorkerOrder = worker;
  const modal = document.querySelector('#workerOrderModal') || (getWorkerOrderModal(), document.querySelector('#workerOrderModal'));
  const image = modal.querySelector('[data-worker-order-image]');
  image.src = worker.photoUrl || '';
  image.alt = `صورة ${worker.name || 'العاملة'}`;
  image.hidden = !worker.photoUrl;
  modal.querySelector('[data-worker-order-name]').textContent = worker.name || 'عاملة منزلية';
  modal.querySelector('[data-worker-order-meta]').textContent = [worker.nationality, worker.profession, worker.service].filter(Boolean).join(' · ');
  modal.querySelector('[data-worker-order-ref]').textContent = `الرقم المرجعي ${worker.ref}`;
  modal.querySelector('#workerOrderMessage').className = 'form-message';
  modal.querySelector('#workerOrderMessage').textContent = '';
  modal.querySelector('#workerOrderForm').reset();
  getWorkerOrderModal().show();
});

document.addEventListener('submit', async event => {
  if (event.target?.id !== 'workerOrderForm') return;
  event.preventDefault();
  const form = event.currentTarget;
  if (!activeWorkerOrder || !form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  const message = document.querySelector('#workerOrderMessage');
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  message.className = 'form-message show';
  message.textContent = 'جارٍ إرسال طلبك…';
  const id = `RQ-${Date.now().toString().slice(-6)}`;
  const note = `طلب مباشر للعاملة ${activeWorkerOrder.name || 'عاملة منزلية'} · الرقم المرجعي ${activeWorkerOrder.ref}`;
  try {
    if (backend?.ready) {
      const payload = {
        id, customer_name: String(values.name || '').trim(), mobile: String(values.mobile || '').trim(),
        service: activeWorkerOrder.service === 'التأجير' ? 'التأجير' : 'الاستقدام',
        nationality: activeWorkerOrder.nationality || '', profession: activeWorkerOrder.profession || '',
        worker_ref: activeWorkerOrder.ref, notes: note, status: 'لم يتم التواصل', assignee: null, internal_notes: ''
      };
      const { error } = await backend.client.from('customer_requests').insert(payload);
      if (error) throw error;
    } else {
      const data = readAdminData();
      if (!Array.isArray(data.requests)) data.requests = [];
      data.requests.unshift({
        id, name: String(values.name || '').trim(), mobile: String(values.mobile || '').trim(),
        service: activeWorkerOrder.service === 'التأجير' ? 'التأجير' : 'الاستقدام',
        preference: [activeWorkerOrder.nationality || 'بدون تفضيل', activeWorkerOrder.profession || 'المهنة غير محددة'].join(' · '),
        date: new Date().toLocaleString('ar-SA'), status: 'لم يتم التواصل', assignee: 'غير معين', notes: note,
        workerRef: activeWorkerOrder.ref,
        worker: { ref: activeWorkerOrder.ref, name: activeWorkerOrder.name, photoUrl: activeWorkerOrder.photoUrl, cvPath: activeWorkerOrder.cvPath, cvFileName: activeWorkerOrder.cvFileName }
      });
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data));
    }
    message.className = 'form-message show success';
    message.textContent = `تم استلام طلبك بنجاح. رقم المتابعة ${id}.`;
    form.reset();
  } catch (error) {
    console.error('Worker order request failed', error);
    message.className = 'form-message show error';
    message.textContent = 'تعذر إرسال الطلب الآن. تحققي من الاتصال ثم حاولي مرة أخرى.';
  } finally {
    submit.disabled = false;
  }
});
