(() => {
  const SUPABASE = window.RAKAEZ_SUPABASE_CONFIG;
  const client = SUPABASE?.url && SUPABASE?.anonKey && window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE.url, SUPABASE.anonKey)
    : null;
  const viewNames = ['home', 'workers', 'rental', 'recruitment', 'request', 'account'];
  const views = [...document.querySelectorAll('[data-app-view]')];
  let workers = [];
  let toastTimer = 0;
  let focusedWorker = false;

  function showToast(message) {
    const toast = document.querySelector('.app-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true }, 4200);
  }

  function openView(name, { updateUrl = true } = {}) {
    const target = viewNames.includes(name) ? name : 'home';
    views.forEach(view => {
      const active = view.dataset.appView === target;
      view.hidden = !active;
      view.classList.toggle('is-active', active);
    });
    document.querySelectorAll('.app-tab').forEach(tab => {
      const active = tab.dataset.openView === target;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    });
    if (updateUrl) history.replaceState(null, '', `${location.pathname}?view=${encodeURIComponent(target)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', event => {
    const chatAction = event.target.closest('[data-open-support-chat]');
    if (chatAction) document.querySelector('.support-chat-launch')?.click();
    const control = event.target.closest('[data-open-view]');
    if (control) openView(control.dataset.openView);
    const serviceAction = event.target.closest('[data-request-service]');
    if (serviceAction) {
      const service = serviceAction.dataset.requestService === 'rental' ? 'التأجير' : 'الاستقدام';
      openView('request');
      const select = document.querySelector('#serviceRequestForm [name="service"]');
      if (select) select.value = service;
    }
    const mode = event.target.closest('[data-request-mode]');
    if (mode) setRequestMode(mode.dataset.requestMode);
    const filter = event.target.closest('[data-worker-filter]');
    if (filter) {
      document.querySelectorAll('[data-worker-filter]').forEach(item => item.classList.toggle('is-selected', item === filter));
      renderWorkers(filter.dataset.workerFilter);
    }
  });

  function setRequestMode(mode) {
    document.querySelectorAll('[data-request-mode]').forEach(button => {
      const selected = button.dataset.requestMode === mode;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    document.querySelectorAll('[data-request-panel]').forEach(panel => { panel.hidden = panel.dataset.requestPanel !== mode });
  }

  const rentalPrices = [
    ['كينيا', 'ke', 1800], ['بوروندي', 'bi', 1800], ['بنغلاديش', 'bd', 2200],
    ['إثيوبيا', 'et', 1800], ['أوغندا', 'ug', 1800], ['إندونيسيا', 'id', 3200]
  ];
  const recruitmentPrices = [
    ['إثيوبيا', 'et', 3777], ['بوروندي', 'bi', 5499], ['بنغلاديش', 'bd', 6999],
    ['كينيا', 'ke', 5599], ['أوغندا', 'ug', 4499], ['سريلانكا', 'lk', 14499], ['الفلبين', 'ph', 13900]
  ];
  const formatPrice = value => new Intl.NumberFormat('ar-SA').format(value);
  function renderPrices(target, rows, service) {
    const element = document.querySelector(target);
    if (!element) return;
    element.innerHTML = rows.map(([country, code, price]) => `<article class="price-row"><img class="country-flag" src="https://flagcdn.com/w80/${code}.png" alt="علم ${country}" width="41" height="28" loading="lazy"><span class="country-name"><strong>${country}</strong><small>${service === 'rental' ? 'السعر للشهر' : 'سعر باقة الاستقدام'}</small></span><strong class="price-value">${formatPrice(price)} ريال</strong><button type="button" data-request-service="${service}">اطلبي</button></article>`).join('');
  }

  renderPrices('#rentalPrices', rentalPrices, 'rental');
  renderPrices('#recruitPrices', recruitmentPrices, 'recruitment');

  function workerCard(worker) {
    const image = worker.photoUrl ? `<img src="${escapeAttr(worker.photoUrl)}" alt="صورة ${escapeAttr(worker.name || 'العاملة')}" loading="lazy">` : '<span class="worker-initial" aria-hidden="true">✧</span>';
    const fields = [worker.nationality, worker.profession || 'عاملة منزلية', worker.age ? `${worker.age} سنة` : '', worker.experience ? `${worker.experience} خبرة` : ''].filter(Boolean).slice(0, 3);
    const price = worker.total_recruitment_cost ? `${formatPrice(Number(worker.total_recruitment_cost))} ريال` : '';
    return `<article class="app-worker-card" data-worker-ref="${escapeAttr(worker.ref || '')}"><div class="worker-photo">${image}</div><div class="worker-details"><span class="app-overline">${escapeHtml(worker.ref || 'متاحة الآن')}</span><h3>${escapeHtml(worker.name || 'عاملة منزلية')}</h3><div class="worker-meta">${fields.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div><div class="worker-card-foot"><small>${escapeHtml(worker.service || 'الاستقدام')}</small>${price ? `<strong class="worker-price-value">${escapeHtml(price)}</strong>` : ''}<button type="button" data-request-service="recruitment">استفسري ←</button></div></div></article>`;
  }

  function renderWorkers(filter = 'all') {
    const filtered = filter === 'all' ? workers : workers.filter(worker => `${worker.service || ''} ${worker.profession || ''}`.includes(filter));
    const html = filtered.length ? filtered.map(workerCard).join('') : '';
    const list = document.querySelector('#allWorkers'), rail = document.querySelector('#homeWorkers'), empty = document.querySelector('#workerEmpty');
    if (list) list.innerHTML = html || '<div class="app-empty">لا توجد ملفات متاحة بهذا الاختيار.</div>';
    if (rail) rail.innerHTML = filtered.slice(0, 6).map(workerCard).join('') || '<div class="app-empty">لا توجد ملفات متاحة الآن. يمكنك متابعة التنبيهات من حسابك.</div>';
    if (empty) empty.hidden = Boolean(filtered.length);
    const focusRef = new URLSearchParams(location.search).get('ref');
    if (!focusedWorker && focusRef && targetView() === 'workers') {
      const match = [...(list?.querySelectorAll('[data-worker-ref]') || [])].find(card => card.dataset.workerRef === focusRef);
      if (match) { focusedWorker = true; match.classList.add('is-highlighted'); requestAnimationFrame(() => match.scrollIntoView({ behavior: 'smooth', block: 'center' })) }
    }
  }

  function targetView() { return new URLSearchParams(location.search).get('view') || 'home' }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;') }

  async function loadWorkers() {
    if (!client) { renderWorkers(); return }
    try {
      let result = await client.from('published_workers').select('ref,name,photo_path,nationality,profession,service,age,experience,total_recruitment_cost,created_at').order('created_at', { ascending: false }).limit(24);
      if (result.error) result = await client.from('published_workers').select('ref,name,photo_path,nationality,profession,service,age,experience,total_recruitment_cost').limit(24);
      if (result.error) throw result.error;
      workers = await Promise.all((result.data || []).map(async worker => {
        let photoUrl = '';
        if (worker.photo_path) {
          const { data } = await client.storage.from('worker-photos').createSignedUrl(worker.photo_path, 3600);
          photoUrl = data?.signedUrl || '';
        }
        return { ...worker, photoUrl };
      }));
      renderWorkers();
    } catch (error) {
      console.error('PWA worker list failed:', error?.message || error);
      const target = document.querySelector('#homeWorkers');
      if (target) target.innerHTML = '<div class="app-empty">تعذر تحميل الملفات الآن. حاولي مرة أخرى بعد قليل.</div>';
      const list = document.querySelector('#allWorkers');
      if (list) list.innerHTML = '<div class="app-empty">تعذر تحميل الملفات الآن. تحققي من الاتصال بالإنترنت.</div>';
    }
  }

  function makeId(prefix) { return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}` }
  async function submitToSupabase(event, table, buildRow, message) {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('button[type="submit"]'), result = form.querySelector('.form-result');
    result.textContent = '';
    result.classList.remove('is-error');
    if (!client) { result.textContent = 'الاتصال بالخدمة غير جاهز. حاولي مرة أخرى لاحقًا.'; result.classList.add('is-error'); return }
    button.disabled = true;
    button.textContent = 'جارٍ الإرسال…';
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const { error } = await client.from(table).insert(buildRow(values));
      if (error) throw error;
      form.reset();
      result.textContent = message;
      showToast(message);
    } catch (error) {
      console.error(`PWA ${table} submission failed:`, error?.message || error);
      result.textContent = 'لم يتم الإرسال. تأكدي من البيانات وحاولي مرة أخرى.';
      result.classList.add('is-error');
    } finally {
      button.disabled = false;
      button.innerHTML = table === 'customer_requests' ? 'إرسال الطلب <span>←</span>' : 'إرسال الشكوى <span>←</span>';
    }
  }

  document.querySelector('#serviceRequestForm')?.addEventListener('submit', event => submitToSupabase(event, 'customer_requests', values => ({
    id: makeId('REQ'), customer_name: values.customer_name.trim(), mobile: values.mobile.trim(), service: values.service,
    nationality: (values.nationality || '').trim(), profession: '', notes: (values.notes || '').trim(),
    status: 'لم يتم التواصل', assignee: null, internal_notes: ''
  }), 'وصل طلبك بنجاح. سيتواصل معك فريق الركائز.'));

  document.querySelector('#complaintForm')?.addEventListener('submit', event => submitToSupabase(event, 'customer_complaints', values => ({
    id: makeId('CMP'), phone: values.phone.trim(), complaint_text: values.complaint_text.trim(),
    status: 'جديدة', source: 'chatbot', assignee: null, internal_notes: ''
  }), 'تم استلام شكواك. سيتواصل معك فريق الإدارة لمعالجتها.'));

  async function applyPublishedTheme() {
    if (!client) return;
    try {
      const { data } = await client.from('site_content').select('theme').eq('id', 1).maybeSingle();
      const allowed = ['sky-light','sky-dark','cyan-light','cyan-dark','ocean-light','teal-light','indigo-light','blue-gold-light'];
      if (data?.theme && allowed.includes(data.theme)) {
        document.documentElement.dataset.siteTheme = data.theme;
        document.body.dataset.siteTheme = data.theme;
      }
    } catch {}
  }

  document.querySelectorAll('[data-open-view]').forEach(button => button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openView(button.dataset.openView) } }));
  const initialView = new URLSearchParams(location.search).get('view') || 'home';
  openView(initialView, { updateUrl: false });
  applyPublishedTheme();
  loadWorkers();
})();
