; (async () => {
  const backend = window.RakaezBackend;
  let currentAccess = null;
  if (backend?.ready) { const page = location.pathname; const required = page.endsWith('/cms.html') ? ['super_admin', 'content_manager'] : page.endsWith('/employees.html') ? ['super_admin'] : page.endsWith('/workers.html') ? ['super_admin', 'workers_manager', 'admin'] : page.endsWith('/complaints.html') ? ['super_admin', 'requests_manager', 'admin'] : page.endsWith('/requests.html') ? ['super_admin', 'requests_manager', 'admin'] : ['super_admin', 'content_manager', 'workers_manager', 'requests_manager', 'admin']; currentAccess = await backend.requireRole(required); if (!currentAccess) return; document.body.classList.add('connected-mode'); document.querySelectorAll('.prototype-badge').forEach(el => el.textContent = `متصل · ${currentAccess.profile.full_name}`); document.querySelectorAll('.sidebar-bottom').forEach(el => el.textContent = 'متصل بقاعدة البيانات · دخول موظفين'); document.querySelectorAll('.notice-prototype').forEach(el => el.textContent = 'البيانات محفوظة على خادم الشركة، ويُحدد الوصول حسب دور الموظف.'); if (currentAccess.profile.role !== 'super_admin') document.querySelectorAll('[data-super-admin-only]').forEach(el => el.hidden = true); if (!['super_admin', 'content_manager'].includes(currentAccess.profile.role)) document.querySelectorAll('[data-content-manager-only]').forEach(el => el.hidden = true); const actions = document.querySelector('.topbar-actions'); if (actions) { const button = document.createElement('button'); button.type = 'button'; button.className = 'button-ghost'; button.textContent = 'تسجيل الخروج'; button.addEventListener('click', () => backend.signOut()); actions.append(button) } }
  const STORAGE_KEY = 'rakaez-admin-prototype-v1';
  const CV_DB = 'rakaez-cv-files-v1';
  const seed = {
    workers: [],
    requests: [
      { id: 'RQ-1048', name: 'عميلة تجريبية 1', mobile: '0000000000', service: 'الاستقدام', preference: 'إثيوبيا · عاملة منزلية', date: 'اليوم، 10:24 ص', status: 'لم يتم التواصل', assignee: 'غير معين', notes: '' },
      { id: 'RQ-1047', name: 'عميلة تجريبية 2', mobile: '0000000000', service: 'التأجير', preference: 'كينيا · عاملة منزلية', date: 'اليوم، 9:10 ص', status: 'تم التواصل ولم يرد', assignee: 'غير معين', notes: '' },
      { id: 'RQ-1046', name: 'عميلة تجريبية 3', mobile: '0000000000', service: 'الاستقدام', preference: 'بدون تفضيل · عاملة منزلية', date: 'أمس، 4:35 م', status: 'رد العميل', assignee: 'موظف تجريبي 1', notes: '' },
      { id: 'RQ-1045', name: 'عميلة تجريبية 4', mobile: '0000000000', service: 'التأجير', preference: 'أوغندا · طاهية منزلية', date: 'أمس، 11:02 ص', status: 'مكتمل', assignee: 'موظف تجريبي 2', notes: '' },
      { id: 'RQ-1044', name: 'عميلة تجريبية 5', mobile: '0000000000', service: 'الاستقدام', preference: 'سريلانكا · مربية', date: '26 أكتوبر، 2:45 م', status: 'معتذر عنه', assignee: 'مدير تجريبي', notes: '' }
    ],
    complaints: [],
    cvRecords: [],
    cms: { headline: 'راحة أسرتك تبدأ من اختيارٍ مطمئن.', subhead: 'تأجير شهري واستقدام عاملات منزلية بإجراءات واضحة، وفريق يتابع احتياجك من أول خطوة.', theme: 'sky-light', sections: [], sectionContent: { hero: { eyebrow: 'حلول منزلية موثوقة للأسر السعودية', title: 'راحة أسرتك تبدأ من اختيارٍ مطمئن.', description: 'تأجير شهري واستقدام عاملات منزلية بإجراءات واضحة، وفريق يتابع احتياجك من أول خطوة.' }, about: { eyebrow: 'من نحن', title: 'نؤمن أن راحة الأسرة تبدأ بحسن الاختيار.', description: 'الركائز البشرية للاستقدام تعمل على تقديم حلول منزلية باهتمام ومهنية. نحرص على وضوح الخطوات ومساندة عملائنا في اختيار الخدمة المناسبة لاحتياجاتهم.' }, services: { eyebrow: 'خدماتنا', title: 'خياران، واحتياجك هو الأساس', description: 'اختر بين خدمة التأجير المرنة أو الاستقدام بما يلائم خطط أسرتك.', rentalTitle: 'تأجير العمالة المنزلية', rentalDescription: 'حل مرن لمن يبحث عن خدمة منزلية لفترة محددة، مع تفاصيل واضحة قبل تقديم الطلب.', recruitmentTitle: 'استقدام العمالة المنزلية', recruitmentDescription: 'ابدأ طلب الاستقدام وتواصل مع الفريق لمعرفة الخيارات المناسبة لك.' }, workers: { eyebrow: 'الخيارات المتاحة', title: 'تصفّح البطاقات بسهولة', description: 'تُعرض الملفات المنشورة برقم مرجعي، دون بيانات شخصية حساسة.' }, cta: { eyebrow: 'خطوتك القادمة', title: 'أخبرنا بما تحتاجه، ونساعدك في الوصول للخيار الأنسب.', description: 'أرسل طلبك المبدئي دون تسجيل حساب.', buttonLabel: 'قدّم طلبك الآن' }, testimonials: { eyebrow: 'آراء العملاء', title: 'تجارب العملاء على Google Maps', description: 'نشارككم تقييمات وآراء العملاء المنشورة على صفحة الشركة الرسمية.' } }, images: {} }
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const numericValue = value => { const normalized = String(value ?? '').trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/٬/g, ',').replace(/٫/g, '.').replace(/,/g, ''); if (!normalized) return null; const number = Number(normalized); return Number.isFinite(number) && number >= 0 ? number : null };
  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const next = { ...clone(seed), ...saved };
      next.cms = { ...clone(seed.cms), ...(saved.cms || {}), images: { ...(saved.cms?.images || {}) }, sectionContent: { ...clone(seed.cms.sectionContent), ...(saved.cms?.sectionContent || {}) } };
      next.workers = Array.isArray(saved.workers) ? saved.workers.filter(worker => worker.cvId) : clone(seed.workers);
      next.requests = Array.isArray(saved.requests) ? saved.requests : clone(seed.requests);
      next.cvRecords = Array.isArray(saved.cvRecords) ? saved.cvRecords : [];
      next.complaints = Array.isArray(saved.complaints) ? saved.complaints : [];
      next.workers.forEach(worker => { if (worker.availability === 'محجوزة') worker.availability = 'تم الحجز'; if (!worker.cvId) worker.cvId = ''; worker.age ||= ''; worker.experience ||= ''; worker.languages ||= ''; worker.skills ||= '' });
      const legacy = { 'قيد المراجعة': 'لم يتم التواصل', 'تم التواصل': 'تم التواصل' };
      next.requests.forEach(request => { request.status = legacy[request.status] || request.status; request.name ||= 'عميلة تجريبية'; request.mobile ||= '0000000000' });
      return next;
    } catch { return clone(seed) }
  }
  let state = readState();
  let activeCvUpload = null; const currentUserId = currentAccess?.session?.user?.id || ''; const themeAliases = { blue: 'sky-light', navy: 'ocean-light', light: 'sky-light' }; state.cms.theme = themeAliases[state.cms.theme] || state.cms.theme || 'sky-light'; state.staffDirectory = []; if (backend?.ready) { state.workers = []; state.requests = []; state.complaints = []; state.cvRecords = []; state.cms.published = false }
  let refreshWorkers = () => { }, refreshRequests = () => { }, refreshDashboard = () => { }, refreshCvRecords = () => { }, refreshComplaints = () => { };
  function saveState(sync = true) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); if (sync && backend?.ready) syncCloudState(); return true } catch { return false } }
  async function syncCloudState() {
    const db = backend?.client; if (!db) return false; const cmsAction = state.cms.cloudAction; try {
      const check = (result, operation = 'Supabase write') => { if (result.error) { const source = result.error, error = new Error(source.message || `${operation} failed`); Object.assign(error, { code: source.code, status: source.status || result.status, details: source.details, hint: source.hint, operation }); throw error } return result };
      const isCmsPage = Boolean(document.querySelector('[data-cms-save],[data-cms-publish]'));
      const { data: { user }, error: authError } = await db.auth.getUser(); if (authError || !user) throw authError || new Error('No authenticated admin session');
      if (isCmsPage) {
        const knownSectionKeys = ['hero', 'about', 'services', 'workers', 'cta', 'testimonials'];
        const domList = document.querySelector('[data-cms-sections]');
        let orderedSections;
        if (domList) {
          orderedSections = [...domList.querySelectorAll('.cms-section')].map(item => ({
            key: item.dataset.section,
            visible: item.querySelector('[data-section-toggle]')?.checked ?? true,
            content: { ...(state.cms.sectionContent[item.dataset.section] || {}) }
          }));
          for (const key of knownSectionKeys) if (!orderedSections.some(section => section.key === key)) orderedSections.push({ key, visible: true, content: { ...(state.cms.sectionContent[key] || {}) } });
        } else {
          orderedSections = (Array.isArray(state.cms.sections) && state.cms.sections.length ? state.cms.sections : knownSectionKeys.map(key => ({ key, visible: true, content: {} }))).map(section => {
            const key = typeof section === 'string' ? section : section.key;
            return { key, visible: typeof section === 'object' ? section.visible ?? true : true, content: { ...(state.cms.sectionContent[key] || {}) } };
          });
        }
        const draft = { headline: state.cms.headline, subhead: state.cms.subhead, theme: state.cms.theme, sections: orderedSections, images: state.cms.images || {} };
        if (cmsAction === 'publish') {
          check(await db.from('site_content').upsert({ id: 1, ...draft, published: true, draft, updated_by: user.id }, { onConflict: 'id' }));
        } else {
          let result = await db.from('site_content').update({ draft, updated_by: user.id }).eq('id', 1).select('id').maybeSingle();
          check(result);
          if (!result.data) check(await db.from('site_content').upsert({ id: 1, ...draft, published: false, draft, updated_by: user.id }, { onConflict: 'id' }));
        }
        state.cms.sections = orderedSections;
        state.cms.cloudAction = 'draft';
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        toast(cmsAction === 'publish' ? 'تم نشر المحتوى على الموقع.' : 'حُفظت المسودة. لن تظهر للزوار حتى تضغطي «نشر التغييرات».');
        return true;
      }
      const workers = state.workers.filter(w => w.cvPath).map(w => ({ ref: w.ref, name: w.name || '', service: w.service, nationality: w.nationality || '', nationality_raw: w.rawFields?.nationality || '', profession: w.profession || '', job_raw: w.rawFields?.job || '', age: w.age || '', age_raw: w.rawFields?.age || '', age_value: numericValue(w.age), salary: w.salary || '', salary_raw: w.rawFields?.salary || '', salary_value: numericValue(w.salary), religion: w.religion || '', religion_raw: w.rawFields?.religion || '', passport_number: w.passportNumber || w.passport_number || '', passport_number_raw: w.rawFields?.passport_number || '', experience: w.experience || '', experience_raw: w.rawFields?.experience || '', experience_value: numericValue(w.experience), languages: w.languages || '', skills: w.skills || '', photo_path: w.photoPath || null, total_recruitment_cost: Number(w.totalRecruitmentCost) || null, availability: w.availability, publication: w.publication, cv_path: w.cvPath, cv_file_name: w.cvFileName || '', extracted: Boolean(w.extracted), created_by: w.createdBy || w.created_by || user.id }));
      if (workers.length) check(await db.from('workers').upsert(workers, { onConflict: 'ref' }), 'worker CV/profile save');
      const requests = state.requests.filter(r => !String(r.name || '').startsWith('عميلة تجريبية')).map(r => ({ id: r.id, status: r.status, assignee: r.assigneeId || null, internal_notes: r.internalNotes || '' }));
      for (const request of requests) { const { id, ...changes } = request; check(await db.from('customer_requests').update(changes).eq('id', id)) }
      const complaints = state.complaints.map(c => ({ id: c.id, status: c.status, assignee: c.assigneeId || null, internal_notes: c.internalNotes || '' }));
      for (const complaint of complaints) { const { id, ...changes } = complaint; check(await db.from('customer_complaints').update(changes).eq('id', id)) }
      return true;
    } catch (error) { console.error('Supabase save failed', { operation: error.operation, status: error.status, code: error.code, message: error.message, details: error.details, hint: error.hint }); toast(error.status === 403 || error.code === '42501' ? 'رفضت صلاحيات Supabase حفظ ملف العاملة. شغّلي ملف supabase/fix-worker-cv-save-permissions.sql ثم أعيدي المحاولة.' : `تعذر مزامنة التغييرات: ${error.message || 'تحققي من الاتصال والصلاحيات.'}`); return false }
  }
  async function loadCloudState() { const db = backend?.client; if (!db) return; try { const canViewRequestedWorkerFiles = ['super_admin', 'requests_manager', 'admin'].includes(currentAccess?.profile.role);
    const requestWorkerQuery = canViewRequestedWorkerFiles ? db.from('request_worker_details').select('ref,name,photo_path,cv_path,cv_file_name') : Promise.resolve({ data: [] });
    const [workersResult, requestsResult, complaintsResult, cmsResult, staffResult, requestWorkerResult] = await Promise.all([db.from('workers').select('*'), db.from('customer_requests').select('*').order('created_at', { ascending: false }), db.from('customer_complaints').select('*').order('created_at', { ascending: false }), db.from('site_content').select('*').eq('id', 1).maybeSingle(), db.from('staff_directory').select('user_id,full_name,role,active'), requestWorkerQuery]); state.staffDirectory = staffResult.data || []; if (workersResult.data) { state.workers = workersResult.data.map(w => ({ ...w, cvId: w.cv_path, cvPath: w.cv_path, cvFileName: w.cv_file_name, photoPath: w.photo_path, createdBy: w.created_by, totalRecruitmentCost: w.total_recruitment_cost, salary: w.salary || '', religion: w.religion || '', passportNumber: w.passport_number || '', rawFields: { nationality: w.nationality_raw || '', job: w.job_raw || '', age: w.age_raw || '', salary: w.salary_raw || '', religion: w.religion_raw || '', experience: w.experience_raw || '', passport_number: w.passport_number_raw || '' }, ageValue: w.age_value, salaryValue: w.salary_value, experienceValue: w.experience_value, availability: w.availability, publication: w.publication })); state.workers = await hydrateWorkerPhotos(state.workers); state.cvRecords = workersResult.data.map(w => ({ id: w.cv_path, fileName: w.cv_file_name, ref: w.ref, date: new Date(w.created_at).toLocaleDateString('ar-SA'), extracted: w.extracted, cloud: true })) } const requestWorkerMap = new Map((requestWorkerResult.data || []).map(worker => [worker.ref, { ref: worker.ref, name: worker.name, photoPath: worker.photo_path, cvPath: worker.cv_path, cvFileName: worker.cv_file_name }])); if (requestsResult.data) { state.requests = requestsResult.data.map(r => ({ id: r.id, name: r.customer_name, mobile: r.mobile, service: r.service, preference: [r.nationality || 'بدون تفضيل', r.profession || 'المهنة غير محددة'].join(' · '), date: new Date(r.created_at).toLocaleString('ar-SA'), status: r.status, assigneeId: r.assignee || '', assignee: state.staffDirectory.find(staff => staff.user_id === r.assignee)?.full_name || 'غير معين', notes: r.notes, internalNotes: r.internal_notes, workerRef: r.worker_ref || '', worker: requestWorkerMap.get(r.worker_ref) || null })) } if (complaintsResult.data) { state.complaints = complaintsResult.data.map(c => ({ id: c.id, phone: c.phone, complaintText: c.complaint_text, status: c.status, source: c.source, date: new Date(c.created_at).toLocaleString('ar-SA'), assigneeId: c.assignee || '', assignee: state.staffDirectory.find(staff => staff.user_id === c.assignee)?.full_name || 'غير معين', internalNotes: c.internal_notes })) } const complaintAssignee = document.querySelector('#complaintAssignee'); if (complaintAssignee && state.staffDirectory.length) complaintAssignee.innerHTML = '<option value="">غير معين</option>' + state.staffDirectory.filter(staff => staff.active !== false).map(staff => `<option value="${esc(staff.user_id)}">${esc(staff.full_name)}</option>`).join(''); const assigneeSelect = document.querySelector('#detailAssignee'); if (assigneeSelect && state.staffDirectory.length) assigneeSelect.innerHTML = '<option value="">غير معين</option>' + state.staffDirectory.filter(staff => staff.active !== false).map(staff => `<option value="${esc(staff.user_id)}">${esc(staff.full_name)}</option>`).join(''); if (cmsResult.data) { const c = cmsResult.data, d = c.draft || {}; state.cms = { ...state.cms, headline: d.headline ?? c.headline, subhead: d.subhead ?? c.subhead, theme: d.theme ?? c.theme, sections: d.sections ?? c.sections, sectionContent: { ...state.cms.sectionContent, ...Object.fromEntries((d.sections ?? c.sections ?? []).filter(item => item && typeof item === 'object').map(item => [item.key, item.content || {}])) }, images: d.images ?? c.images, published: c.published }; state.cms.theme = themeAliases[state.cms.theme] || state.cms.theme || 'sky-light'; state.cms.sectionContent.hero = { ...state.cms.sectionContent.hero, title: state.cms.sectionContent.hero?.title || state.cms.headline, description: state.cms.sectionContent.hero?.description || state.cms.subhead } } document.querySelectorAll('[data-cms-field]').forEach(field => { if (state.cms[field.dataset.cmsField] !== undefined) field.value = state.cms[field.dataset.cmsField] }); document.querySelectorAll('[data-cms-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cmsThemeChoice === (state.cms.theme || 'sky-light')))); document.querySelectorAll('.cms-preview').forEach(preview => preview.dataset.siteTheme = state.cms.theme || 'sky-light'); document.querySelectorAll('[data-cms-image]').forEach(input => { const key = input.dataset.cmsImage, image = state.cms.images?.[key], preview = document.querySelector(`[data-cms-image-preview="${key}"]`); if (image && preview) preview.src = image }); setCmsVideoPreview(state.cms.images?.video); document.body.dataset.siteTheme = state.cms.theme || 'sky-light'; document.querySelectorAll('[data-cms-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cmsThemeChoice === (state.cms.theme || 'sky-light')))); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); refreshDashboard(); refreshWorkers(); refreshCvRecords(); refreshRequests(); refreshComplaints(); document.dispatchEvent(new Event('rakaez-cms-loaded')) } catch (error) { console.error('Supabase load failed', error); toast('تعذر تحميل البيانات من قاعدة البيانات.') } }
  if (backend?.ready) loadCloudState();
  window.addEventListener('storage', event => { if (event.key !== STORAGE_KEY) return; state = readState(); refreshDashboard(); refreshWorkers(); refreshCvRecords(); refreshRequests() });
  const employeeRows = document.querySelector('[data-employee-rows]');
  if (employeeRows) {
    async function refreshEmployees() { const count = document.querySelector('[data-employee-count]'); if (!backend?.ready) { employeeRows.innerHTML = '<tr><td colspan="5"><div class="empty-state">اتصلي بمشروع Supabase لعرض حسابات الموظفين.</div></td></tr>'; if (count) count.textContent = 'غير متصل'; return } const { data, error } = await backend.client.from('employee_profiles').select('user_id,full_name,role,active,created_at').order('created_at', { ascending: false }); if (error) { console.error('Employee list failed', error); employeeRows.innerHTML = '<tr><td colspan="5"><div class="empty-state">تعذر تحميل الموظفين. تحققي من صلاحيات مدير النظام.</div></td></tr>'; return } if (count) count.textContent = `${data.length} حسابات`; employeeRows.innerHTML = data.length ? data.map(employee => `<tr><td><span class="cell-title">${esc(employee.full_name)}</span></td><td>${employee.role === 'super_admin' ? 'مدير النظام' : employee.role === 'admin' ? 'أدمن' : employee.role === 'content_manager' ? 'مدير محتوى' : employee.role === 'workers_manager' ? 'مدير ملفات العاملات' : 'مدير الطلبات'}</td><td class="record-id" dir="ltr">${esc(employee.user_id)}</td><td><span class="status-badge ${employee.active ? 'status-available' : 'status-draft'}">${employee.active ? 'مفعل' : 'موقوف'}</span></td><td>${employee.role === 'admin' ? `<button type="button" class="row-action" data-admin-toggle="${esc(employee.user_id)}" data-active="${employee.active}">${employee.active ? 'إيقاف الدخول' : 'إعادة التفعيل'}</button>` : '—'}</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state">لا توجد حسابات موظفين حتى الآن.</div></td></tr>' }
    document.querySelector('[data-employee-refresh]')?.addEventListener('click', refreshEmployees);
    document.querySelector('#employeeForm')?.addEventListener('submit', async event => { event.preventDefault(); const name = document.querySelector('#employeeName').value.trim(), userId = document.querySelector('#employeeUid').value.trim(); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) { toast('أدخلي User UID صحيحًا من Supabase Auth.'); return } const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true; const { error } = await backend.client.from('employee_profiles').insert({ user_id: userId, full_name: name, role: 'admin', active: true }); button.disabled = false; if (error) { console.error('Admin profile insert failed', error); toast(error.code === '23505' ? 'هذا الحساب مضاف بالفعل.' : 'تعذر الإضافة. تأكدي أن المستخدم موجود في Supabase Auth وأنكِ مديرة النظام.'); return } event.currentTarget.reset(); toast('تمت إضافة الأدمن بالصلاحيات المحدودة.'); await refreshEmployees() });
    employeeRows.addEventListener('click', async event => { const button = event.target.closest('[data-admin-toggle]'); if (!button) return; button.disabled = true; const { error } = await backend.client.from('employee_profiles').update({ active: button.dataset.active !== 'true' }).eq('user_id', button.dataset.adminToggle).eq('role', 'admin'); if (error) { button.disabled = false; toast('تعذر تحديث حالة الأدمن.'); return } toast(button.dataset.active === 'true' ? 'تم إيقاف حساب الأدمن.' : 'تمت إعادة تفعيل حساب الأدمن.'); await refreshEmployees() });
    refreshEmployees();
  }
  function toast(message) {
    const container = document.querySelector('.toast-container'); if (!container) return;
    const el = document.createElement('div'); el.className = 'toast admin-toast text-bg-dark'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(message)}</div><button type="button" class="btn-close btn-close-white ms-auto me-2" data-bs-dismiss="toast" aria-label="إغلاق"></button></div>`; container.append(el);
    if (window.bootstrap?.Toast) { new bootstrap.Toast(el, { delay: 3400 }).show(); el.addEventListener('hidden.bs.toast', () => el.remove()) } else { el.classList.add('show'); setTimeout(() => el.remove(), 3400) }
  }
  function downloadCsv(filename, headers, rows) { const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000) }
  function setCmsVideoPreview(url) { const preview = document.querySelector('[data-cms-video-preview]'); if (!preview) return; if (url) { preview.src = url; preview.hidden = false; preview.load() } else { preview.pause(); preview.removeAttribute('src'); preview.hidden = true } }
  async function hydrateWorkerPhotos(workers) { return Promise.all(workers.map(async worker => { if (!worker.photoPath) return worker; try { const { data, error } = await backend.client.storage.from('worker-photos').download(worker.photoPath); return error || !data ? worker : { ...worker, photoUrl: URL.createObjectURL(data) } } catch { return worker } })) }

  // Shared navigation drawer.
  const sidebar = document.querySelector('#adminSidebar'), scrim = document.querySelector('.sidebar-scrim');
  document.querySelector('[data-sidebar-toggle]')?.addEventListener('click', () => { sidebar?.classList.add('open'); scrim?.classList.add('show') });
  document.querySelectorAll('[data-sidebar-close]').forEach(el => el.addEventListener('click', () => { sidebar?.classList.remove('open'); scrim?.classList.remove('show') }));
  document.querySelectorAll('.admin-nav a.disabled').forEach(link => link.addEventListener('click', event => { event.preventDefault(); toast('هذا القسم ضمن مرحلة لاحقة من التطوير.') }));

  // CMS text and image editing. Images are resized before local browser storage.
  const cmsFields = [...document.querySelectorAll('[data-cms-field]')];
  if (cmsFields.length) {
    cmsFields.forEach(field => { const key = field.dataset.cmsField; if (state.cms[key] !== undefined) field.value = state.cms[key] });
    const sectionSchemas = { hero: { title: 'القسم الرئيسي', hint: 'عدّلي عنوان المقدمة والنص والصورة الخلفية.', fields: [['eyebrow', 'النص التمهيدي'], ['title', 'العنوان الرئيسي'], ['description', 'النص التعريفي']], images: [['hero', 'صورة خلفية القسم الرئيسي']] }, about: { title: 'قسم عن الشركة', hint: 'عدّلي نبذة الشركة والصورة الظاهرة في هذا القسم.', fields: [['eyebrow', 'العنوان الصغير'], ['title', 'عنوان القسم'], ['description', 'نبذة الشركة']], images: [['about', 'صورة عن الشركة']] }, services: { title: 'قسم الخدمات', hint: 'عدّلي وصف الخدمات وصورة منفصلة لكل بطاقة.', fields: [['eyebrow', 'العنوان الصغير'], ['title', 'عنوان القسم'], ['description', 'وصف القسم'], ['rentalTitle', 'عنوان بطاقة التأجير'], ['rentalDescription', 'وصف بطاقة التأجير'], ['recruitmentTitle', 'عنوان بطاقة الاستقدام'], ['recruitmentDescription', 'وصف بطاقة الاستقدام']], images: [['servicesRental', 'صورة بطاقة التأجير'], ['servicesRecruitment', 'صورة بطاقة الاستقدام']] }, workers: { title: 'قسم العاملات المتاحات', hint: 'عدّلي عنوان القسم والوصف والصورة التعريفية.', fields: [['eyebrow', 'العنوان الصغير'], ['title', 'عنوان القسم'], ['description', 'وصف القسم']], images: [['workers', 'صورة قسم العاملات']] }, cta: { title: 'قسم تقديم الطلب', hint: 'عدّلي رسالة الدعوة ونص زر الطلب.', fields: [['eyebrow', 'العنوان الصغير'], ['title', 'عنوان الدعوة'], ['description', 'الوصف'], ['buttonLabel', 'نص الزر']], images: [['cta', 'صورة خلفية الدعوة']] }, testimonials: { title: 'آراء العملاء', hint: 'تُعرض تقييمات Google Maps بعد تفعيل Google Places API.', fields: [['eyebrow', 'العنوان الصغير'], ['title', 'عنوان القسم'], ['description', 'وصف القسم']], images: [] } };
    let selectedSection = 'hero';
    const sectionEditor = document.querySelector('[data-cms-section-editor]');
    function renderSectionEditor(key) { const schema = sectionSchemas[key]; if (!schema || !sectionEditor) return; selectedSection = key; const values = state.cms.sectionContent[key] || {}; document.querySelectorAll('.cms-section').forEach(row => row.classList.toggle('selected', row.dataset.section === key)); document.querySelector('[data-cms-editor-title]').textContent = schema.title; document.querySelector('[data-cms-editor-hint]').textContent = schema.hint; sectionEditor.innerHTML = schema.fields.map(([name, label]) => `<div class="form-field"><label for="cmsContent-${name}">${label}</label>${name.toLowerCase().includes('description') ? `<textarea class="admin-textarea" id="cmsContent-${name}" data-cms-section-field="${name}">${esc(values[name] || '')}</textarea>` : `<input class="admin-input" id="cmsContent-${name}" data-cms-section-field="${name}" value="${esc(values[name] || '')}">`}</div>`).join('') + schema.images.map(([imageKey, label]) => { const saved = state.cms.images?.[imageKey] || ''; return `<div class="cms-section-image"><label>${label}</label><img data-cms-section-image-preview="${imageKey}" src="${esc(saved)}" alt="معاينة ${label}" ${saved ? '' : 'hidden'}><label class="button-secondary" for="cmsImage-${imageKey}">رفع أو تغيير الصورة</label><input id="cmsImage-${imageKey}" type="file" accept="image/*" data-cms-section-image="${imageKey}"></div>` }).join(''); sectionEditor.querySelectorAll('[data-cms-section-field]').forEach(field => field.addEventListener('input', () => { state.cms.sectionContent[key] = { ...(state.cms.sectionContent[key] || {}), [field.dataset.cmsSectionField]: field.value }; if (key === 'hero') { state.cms.headline = state.cms.sectionContent.hero.title || ''; state.cms.subhead = state.cms.sectionContent.hero.description || '' } updatePreview() })); sectionEditor.querySelectorAll('[data-cms-section-image]').forEach(input => input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) { toast('اختاري ملف صورة صالحًا.'); return } try { let image = await compressImage(file); if (backend?.ready) { const blob = await (await fetch(image)).blob(), path = `sections/${imageKey}/${Date.now()}.jpg`, { error } = await backend.client.storage.from('site-media').upload(path, blob, { contentType: 'image/jpeg' }); if (error) throw error; image = backend.client.storage.from('site-media').getPublicUrl(path).data.publicUrl } state.cms.images = { ...(state.cms.images || {}), [imageKey]: image }; const preview = sectionEditor.querySelector(`[data-cms-section-image-preview="${imageKey}"]`); if (preview) { preview.src = image; preview.hidden = false } toast('تم تحديث الصورة في المسودة. احفظي المسودة أو انشري التغييرات.') } catch (error) { console.error('CMS section image upload failed', error); toast('تعذر رفع الصورة. تحقق من صلاحيات site-media.') } finally { input.value = '' } })) }
    renderSectionEditor(selectedSection);
    const list = document.querySelector('[data-cms-sections]');
    if (list && Array.isArray(state.cms.sections) && state.cms.sections.length) { const map = new Map([...list.children].map(item => [item.dataset.section, item])); state.cms.sections.forEach(entry => { const key = typeof entry === 'string' ? entry : entry.key; const item = map.get(key); if (item) { list.append(item); if (typeof entry === 'object' && entry.visible !== undefined) { const toggle = item.querySelector('[data-section-toggle]'); if (toggle) toggle.checked = entry.visible } } }); for (const item of map.values()) if (item.parentElement === list) list.append(item) }
    const updatePreview = () => { const values = Object.fromEntries(cmsFields.map(field => [field.dataset.cmsField, field.value])), current = state.cms.sectionContent[selectedSection] || {}, previewSchema = sectionSchemas[selectedSection], previewImageKey = previewSchema?.images?.[0]?.[0], previewImage = state.cms.images?.[previewImageKey]; document.querySelectorAll('.cms-preview').forEach(preview => { preview.dataset.siteTheme = values.theme || 'sky-light'; if (previewImage) preview.style.setProperty('--cms-preview-image', 'url(' + JSON.stringify(previewImage) + ')') }); document.querySelectorAll('[data-cms-preview-headline],[data-cms-modal-headline]').forEach(el => el.textContent = current.title || values.headline || ''); document.querySelectorAll('[data-cms-preview-subhead],[data-cms-modal-subhead]').forEach(el => el.textContent = current.description || values.subhead || '') };
    cmsFields.forEach(field => field.addEventListener('input', updatePreview));
    const themeInput = document.querySelector('[data-cms-field="theme"]');
    const syncThemeButtons = () => document.querySelectorAll('[data-cms-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cmsThemeChoice === themeInput?.value)));
    document.querySelectorAll('[data-cms-theme-choice]').forEach(button => button.addEventListener('click', () => { if (!themeInput) return; themeInput.value = button.dataset.cmsThemeChoice; state.cms.theme = themeInput.value; saveState(false); document.querySelectorAll('.cms-preview').forEach(preview => preview.dataset.siteTheme = themeInput.value); syncThemeButtons(); updatePreview() })); syncThemeButtons();
    renderSectionEditor(selectedSection);
    if (list) { list.querySelectorAll('.cms-section').forEach(item => { const info = item.querySelector(':scope > div'); if (info && !info.querySelector('.cms-move-buttons')) { const controls = document.createElement('span'); controls.className = 'cms-move-buttons'; controls.innerHTML = '<button type="button" data-section-move="up" aria-label="تحريك لأعلى">↑</button><button type="button" data-section-move="down" aria-label="تحريك لأسفل">↓</button>'; info.append(controls) } }); const renumber = () => [...list.querySelectorAll('.cms-section')].forEach((item, index) => { const label = item.querySelector('.section-number'); if (label) label.textContent = String(index + 1).padStart(2, '0') }); list.addEventListener('click', event => { const row = event.target.closest('.cms-section'), move = event.target.closest('[data-section-move]'); if (move && row) { event.preventDefault(); if (move.dataset.sectionMove === 'up' && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling); if (move.dataset.sectionMove === 'down' && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row); renumber(); return } if (row && !event.target.closest('input,label,.drag-handle')) renderSectionEditor(row.dataset.section) }); let dragged = null; list.querySelectorAll('.cms-section').forEach(item => { item.addEventListener('dragstart', () => { dragged = item; item.classList.add('dragging') }); item.addEventListener('dragend', () => { item.classList.remove('dragging'); list.querySelectorAll('.cms-section').forEach(row => row.classList.remove('drag-over')); dragged = null; renumber() }); item.addEventListener('dragover', event => { event.preventDefault(); if (item !== dragged) item.classList.add('drag-over') }); item.addEventListener('dragleave', () => item.classList.remove('drag-over')); item.addEventListener('drop', event => { event.preventDefault(); item.classList.remove('drag-over'); if (dragged && dragged !== item) { const box = item.getBoundingClientRect(); list.insertBefore(dragged, event.clientY < box.top + box.height / 2 ? item : item.nextSibling); renumber() } }) }) }
    function readCmsForm() { const fields = Object.fromEntries(cmsFields.map(field => [field.dataset.cmsField, field.value])); state.cms = { ...state.cms, ...fields, headline: state.cms.sectionContent.hero?.title || state.cms.headline, subhead: state.cms.sectionContent.hero?.description || state.cms.subhead, sections: list ? [...list.querySelectorAll('.cms-section')].map(item => ({ key: item.dataset.section, visible: item.querySelector('[data-section-toggle]')?.checked ?? false, content: state.cms.sectionContent[item.dataset.section] || {} })) : state.cms.sections, images: state.cms.images || {} } }
    const saveCmsAction = async action => {
      readCmsForm(); state.cms.cloudAction = action;
      if (!saveState(false)) { toast('تعذر حفظ المحتوى محليًا؛ مساحة المتصفح ممتلئة.'); return }
      if (!backend?.ready) { toast(action === 'publish' ? 'الموقع غير متصل بقاعدة البيانات؛ لم يتم النشر.' : 'حُفظت المسودة محليًا على هذا المتصفح فقط.'); return }
      const buttons = [...document.querySelectorAll('[data-cms-save],[data-cms-publish]')]; buttons.forEach(button => { button.disabled = true });
      try { await syncCloudState() } finally { buttons.forEach(button => { button.disabled = false }) }
    };
    document.querySelector('[data-cms-save]')?.addEventListener('click', () => saveCmsAction('draft'));
    document.querySelector('[data-cms-publish]')?.addEventListener('click', () => saveCmsAction('publish'));
    document.querySelector('[data-cms-preview]')?.addEventListener('click', () => { updatePreview(); if (window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(document.querySelector('#cmsPreviewModal')).show() });
    document.querySelectorAll('[data-cms-image]').forEach(input => {
      const key = input.dataset.cmsImage, preview = document.querySelector(`[data-cms-image-preview="${key}"]`), saved = state.cms.images?.[key]; if (saved) { if (preview) preview.src = saved; if (key === 'hero') document.querySelectorAll('.cms-preview').forEach(el => el.style.setProperty('--cms-preview-image', `url("${saved}")`)) }
      input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) { toast('اختر ملف صورة صالحًا.'); return } try { let image = await compressImage(file); if (backend?.ready) { const blob = await (await fetch(image)).blob(), path = `${key}/${Date.now()}.jpg`, { error } = await backend.client.storage.from('site-media').upload(path, blob, { contentType: 'image/jpeg' }); if (error) throw error; image = backend.client.storage.from('site-media').getPublicUrl(path).data.publicUrl } state.cms.images = { ...(state.cms.images || {}), [key]: image }; if (preview) preview.src = image; if (key === 'hero') document.querySelectorAll('.cms-preview').forEach(el => el.style.setProperty('--cms-preview-image', `url("${image}")`)); readCmsForm(); if (!saveState()) throw new Error('storage'); toast(backend?.ready ? 'تم رفع الصورة وحفظ رابطها.' : 'تم تحديث الصورة وحفظها محليًا.') } catch { toast('تعذر رفع الصورة أو حفظها. تحقق من الصلاحيات وحاول مجددًا.') } })
    });
    const videoInput = document.querySelector('[data-cms-video]'), videoStatus = document.querySelector('[data-cms-video-status]'); setCmsVideoPreview(state.cms.images?.video);
    videoInput?.addEventListener('change', async () => { const file = videoInput.files?.[0]; if (!file) return; if (!['video/mp4', 'video/webm'].includes(file.type)) { if (videoStatus) videoStatus.textContent = 'الملف غير مدعوم. استخدم MP4 أو WebM.'; videoInput.value = ''; return } if (file.size > 50 * 1024 * 1024) { if (videoStatus) videoStatus.textContent = 'حجم الفيديو يتجاوز 50 ميجابايت.'; videoInput.value = ''; return } if (!backend?.ready) { if (videoStatus) videoStatus.textContent = 'فعّل اتصال Supabase لرفع الفيديو وحفظه للموقع.'; return } const pick = document.querySelector('.cms-video-pick'); if (pick) pick.textContent = 'جارٍ الرفع…'; if (videoStatus) videoStatus.textContent = 'جارٍ رفع الفيديو إلى مساحة الموقع…'; try { const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').slice(-80), path = `videos/${Date.now()}-${safeName}`, { error } = await backend.client.storage.from('site-media').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false }); if (error) throw error; const url = backend.client.storage.from('site-media').getPublicUrl(path).data.publicUrl; state.cms.images = { ...(state.cms.images || {}), video: url, videoPath: path }; setCmsVideoPreview(url); if (!saveState()) throw new Error('storage'); if (videoStatus) videoStatus.textContent = `تم رفع ${file.name}. احفظ المسودة ثم انشرها لإظهار الفيديو على الموقع.`; toast('تم رفع الفيديو وحفظه في مسودة المحتوى.') } catch (error) { console.error('Video upload failed', error); if (videoStatus) videoStatus.textContent = 'تعذر رفع الفيديو. تأكد من تحديث إعدادات bucket site-media في Supabase.'; toast('تعذر رفع الفيديو إلى Supabase.') } finally { if (pick) pick.textContent = 'اختيار فيديو جديد'; videoInput.value = '' } });
    document.querySelector('[data-cms-video-remove]')?.addEventListener('click', () => { state.cms.images = { ...(state.cms.images || {}) }; delete state.cms.images.video; delete state.cms.images.videoPath; setCmsVideoPreview(''); if (videoStatus) videoStatus.textContent = 'أزيل الفيديو من المسودة. انشر التغييرات لتحديث الموقع.'; saveState(); toast('أزيل فيديو المسودة.') });
    updatePreview(); document.addEventListener('rakaez-cms-loaded', () => renderSectionEditor(selectedSection));
  }
  function compressImage(file) { return new Promise((resolve, reject) => { const url = URL.createObjectURL(file), image = new Image(); image.onload = () => { const scale = Math.min(1, 1800 / Math.max(image.width, image.height)), canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); resolve(canvas.toDataURL('image/jpeg', .82)) }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')) }; image.src = url }) }

  // IndexedDB stores local PDF bytes. Only extracted profile fields go into localStorage.
  function openCvDb() { return new Promise((resolve, reject) => { if (!indexedDB) { reject(new Error('indexeddb')); return } const request = indexedDB.open(CV_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
  async function cvDbAction(mode, value) { const db = await openCvDb(); return new Promise((resolve, reject) => { const tx = db.transaction('files', mode === 'get' ? 'readonly' : 'readwrite'), store = tx.objectStore('files'); const req = mode === 'put' ? store.put(value) : mode === 'delete' ? store.delete(value) : store.get(value); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); tx.oncomplete = () => db.close() }) }
  function parsePdfFields(text, fileName, ref) { const flat = text.replace(/[\u00a0\t]+/g, ' ').replace(/\r/g, '\n'); const pick = patterns => { for (const pattern of patterns) { const match = flat.match(pattern); if (match?.[1]) return match[1].trim().replace(/\s{2,}/g, ' ').slice(0, 100) } return '' }; const normalizeDigits = value => value.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٬/g, ',').replace(/٫/g, '.'); const name = pick([/(?:\bfull\s*name\b|\bcandidate\s*name\b|\bname\b|الاسم(?:\s+بالكامل|\s+الكامل|\s+الرباعي|\s+العاملة|\s+المرشحة)?)\s*[:：\-]?\s*([^\n]{2,70})/i]); const nationality = pick([/(?:\bnationality\b|الجنسية)\s*[:：\-]?\s*([^\n]{2,50})/i]); const profession = pick([/(?:\bprofession\b|\boccupation\b|\bjob\s*title\b|المهنة|الوظيفة)\s*[:：\-]?\s*([^\n]{2,60})/i]); const age = normalizeDigits(pick([/(?:\bage\b|العمر|السن)\s*[:：\-]?\s*([0-9٠-٩]{1,2}(?:\s*(?:years?|سنة|عام))?)/i])); const experience = pick([/(?:\byears?\s+of\s+experience\b|\bexperience\b|سنوات\s+الخبرة|الخبرة)\s*[:：\-]?\s*([^\n]{1,55})/i]); const languages = pick([/(?:\blanguages?\b|اللغات)\s*[:：\-]?\s*([^\n]{1,70})/i]); const skills = pick([/(?:\bskills\b|المهارات)\s*[:：\-]?\s*([^\n]{1,90})/i]); const priceRaw = normalizeDigits(pick([/(?:total\s+recruitment\s+(?:cost|price)|recruitment\s+(?:cost|fee)|total\s+fee|إجمالي\s+(?:سعر|تكلفة)\s+الاستقدام|تكلفة\s+الاستقدام|السعر\s+الإجمالي)\s*[:：\-]?\s*(?:(?:\bSAR\b|\bSR\b|ريال(?:\s+سعودي)?|ر\.س\.?)\s*)?([0-9٠-٩٬,]+(?:[.٫][0-9٠-٩]{1,2})?)/i])); const totalRecruitmentCost = priceRaw ? String(Number.parseFloat(priceRaw.replace(/,/g, '')) || '') : ''; const matchCount = [name, nationality, profession, age, experience, languages, skills, totalRecruitmentCost].filter(Boolean).length; return { name: name || fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '), nationality, profession: profession || 'عاملة منزلية', age, experience, languages, skills, totalRecruitmentCost, matchCount, ref } }
  async function extractPdfText(file) { if (!window.pdfjsLib) throw new Error('pdfjs'); const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const pages = []; for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 10); pageNo++) { const page = await pdf.getPage(pageNo), content = await page.getTextContent(); let previousY = null; const text = content.items.map(item => { const y = item.transform?.[5]; const lineBreak = previousY !== null && Number.isFinite(y) && Math.abs(y - previousY) > 2; previousY = Number.isFinite(y) ? y : previousY; return `${lineBreak ? '\n' : ' '}${item.str}` }).join('').trim(); pages.push(text) } return pages.join('\n') }
  async function extractPdfPhoto(file) { if (!window.pdfjsLib) throw new Error('pdfjs'); const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, page = await pdf.getPage(1), viewport = page.getViewport({ scale: .65 }), canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise; const ops = await page.getOperatorList(), names = []; for (let i = 0; i < ops.fnArray.length; i++) { const fn = ops.fnArray[i]; if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) { const name = ops.argsArray[i]?.[0]; if (name && !names.includes(name)) names.push(name) } } const images = []; for (const name of names) { try { const store = page.objs.has(name) ? page.objs : page.commonObjs; if (!store.has(name)) continue; const image = store.get(name), width = image?.width, height = image?.height, data = image?.data; if (!width || !height || width < 90 || height < 100 || !data) continue; const ratio = width / height, pageRatio = page.view[2] / page.view[3]; if (ratio < .42 || ratio > 1.35 || (width > 900 && height > 1200 && Math.abs(ratio - pageRatio) < .02)) continue; const pixels = width * height, rgba = new Uint8ClampedArray(pixels * 4); if (data.length === pixels * 4) rgba.set(data); else if (data.length === pixels * 3) { for (let p = 0, s = 0; p < pixels; p++, s += 3) { const d = p * 4; rgba[d] = data[s]; rgba[d + 1] = data[s + 1]; rgba[d + 2] = data[s + 2]; rgba[d + 3] = 255 } } else if (data.length === pixels) { for (let p = 0; p < pixels; p++) { const d = p * 4; rgba[d] = rgba[d + 1] = rgba[d + 2] = data[p]; rgba[d + 3] = 255 } } else continue; images.push({ width, height, rgba, score: pixels }) } catch { } } if (!images.length) return null; images.sort((a, b) => b.score - a.score); const selected = images[0], out = document.createElement('canvas'); out.width = selected.width; out.height = selected.height; out.getContext('2d').putImageData(new ImageData(selected.rgba, selected.width, selected.height), 0, 0); return new Promise(resolve => out.toBlob(blob => resolve(blob), 'image/jpeg', .9)) }

  const dashboardRows = document.querySelector('[data-dashboard-requests]');
  if (dashboardRows) { refreshDashboard = () => { const followUp = state.requests.filter(request => !['مكتمل', 'معتذر عنه'].includes(request.status)), newComplaints = state.complaints.filter(complaint => complaint.status === 'جديدة'), complaintRows = state.complaints.slice(0, 5); document.querySelector('[data-dashboard-new]').textContent = state.requests.filter(request => ['جديد', 'لم يتم التواصل'].includes(request.status)).length; document.querySelector('[data-dashboard-workers]').textContent = state.workers.filter(worker => worker.publication === 'منشورة' && worker.availability === 'متاحة').length; document.querySelector('[data-dashboard-review]').textContent = state.workers.filter(worker => worker.publication === 'مسودة').length; document.querySelector('[data-dashboard-cms]').textContent = (state.cms.sections || []).filter(section => typeof section === 'object' && !section.visible).length; document.querySelector('[data-dashboard-complaints]').textContent = newComplaints.length; const unassigned = document.querySelector('[data-dashboard-unassigned]'); if (unassigned) unassigned.textContent = [...followUp, ...state.complaints.filter(item => item.status !== 'تم الحل')].filter(item => !item.assigneeId && (!item.assignee || item.assignee === 'غير معين')).length; document.querySelector('[data-dashboard-request-count]').textContent = `${followUp.length} طلبات مفتوحة`; dashboardRows.innerHTML = followUp.length ? followUp.slice(0, 6).map(request => `<tr><td class="record-id">${esc(request.id)}</td><td><span class="cell-title">${esc(request.service)}</span></td><td>${esc(request.name || 'عميلة')}<small class="cell-sub">${esc(request.mobile || '')}</small></td><td>${esc(request.date)}</td><td><span class="status-badge ${request.status === 'تم التواصل ولم يرد' ? 'status-reserved' : 'status-progress'}">${esc(request.status)}</span></td><td>${esc(request.assignee || 'غير معين')}</td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><strong>لا توجد طلبات مفتوحة</strong>الطلبات الجديدة ستظهر هنا.</div></td></tr>'; const complaintTable = document.querySelector('[data-dashboard-complaint-rows]'), complaintCount = document.querySelector('[data-dashboard-complaint-count]'); if (complaintCount) complaintCount.textContent = `${state.complaints.length} شكاوى مسجلة`; if (complaintTable) complaintTable.innerHTML = complaintRows.length ? complaintRows.map(complaint => `<tr><td class="record-id">${esc(complaint.id)}</td><td>${esc(complaint.date)}</td><td dir="ltr">${esc(complaint.phone)}</td><td>${esc(complaint.complaintText.slice(0, 90))}</td><td>${esc(complaint.status)}</td><td>${esc(complaint.assignee || 'غير معين')}</td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><strong>لا توجد شكاوى بعد</strong>الشكاوى المرسلة من الشات ستظهر هنا.</div></td></tr>' }; refreshDashboard() }

  // Worker profiles and availability.
  const workerBody = document.querySelector('#workerTableBody');
  if (workerBody) {
    const search = document.querySelector('#workerAdminSearch'), service = document.querySelector('#workerServiceFilter'), availability = document.querySelector('#workerStatusFilter'), publication = document.querySelector('#workerPublishFilter');
    const badgeClass = value => value === 'متاحة' ? 'status-available' : value === 'تم الحجز' ? 'status-reserved' : value === 'منشورة' ? 'status-available' : value === 'مؤرشفة' ? 'status-draft' : 'status-unavailable';
    function renderWorkers() { const q = (search.value || '').trim().toLowerCase(); const rows = state.workers.filter(w => (!q || `${w.ref} ${w.name || ''} ${w.nationality}`.toLowerCase().includes(q)) && (!service.value || w.service === service.value) && (!availability.value || w.availability === availability.value) && (!publication.value || w.publication === publication.value)); document.querySelector('[data-worker-count]').textContent = `${rows.length} من ${state.workers.length} ملفات`; workerBody.innerHTML = rows.length ? rows.map(w => `<tr><td class="record-id">${esc(w.ref)}</td><td><span class="cell-title">${esc(w.service)}</span></td><td>${esc(w.nationality || 'تحتاج مراجعة')}</td><td>${esc(w.profession || 'عاملة منزلية')}</td><td><span class="status-badge ${badgeClass(w.availability)}">${esc(w.availability)}</span></td><td><span class="status-badge ${w.publication === 'منشورة' ? 'status-available' : 'status-draft'}">${esc(w.publication)}</span></td><td><div class="row-actions">${currentAccess?.profile.role === 'admin' ? (w.publication === 'مسودة' ? `<button class="row-action" data-worker-edit="${esc(w.ref)}">مراجعة المسودة</button>` : '—') : `<button class="row-action" data-worker-edit="${esc(w.ref)}">تعديل</button><button class="row-action" data-worker-availability="${esc(w.ref)}">${w.availability === 'متاحة' ? 'تم الحجز' : 'إتاحة'}</button><button class="row-action" data-worker-publish="${esc(w.ref)}">${w.publication === 'منشورة' ? 'إلغاء النشر' : 'نشر'}</button><button class="row-action" data-worker-archive="${esc(w.ref)}">أرشفة</button>`}</div></td></tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><strong>لا توجد نتائج</strong>جرّب تغيير خيارات التصفية.</div></td></tr>' }
    refreshWorkers = renderWorkers;
    [search, service, availability, publication].forEach(el => el?.addEventListener('input', renderWorkers));[service, availability, publication].forEach(el => el?.addEventListener('change', renderWorkers));
    workerBody.addEventListener('click', event => { const editButton = event.target.closest('[data-worker-edit]'), availabilityButton = event.target.closest('[data-worker-availability]'), publishButton = event.target.closest('[data-worker-publish]'), archiveButton = event.target.closest('[data-worker-archive]'); const button = editButton || availabilityButton || publishButton || archiveButton, ref = button?.dataset.workerEdit || button?.dataset.workerAvailability || button?.dataset.workerPublish || button?.dataset.workerArchive; if (!ref) return; const worker = state.workers.find(w => w.ref === ref); if (!worker) return; if (editButton) { document.querySelector('#workerProfilePdfButton').hidden = true; activeCvUpload = null; const form = document.querySelector('#workerForm'); document.querySelector('#workerEditRef').value = worker.ref; form.elements.namedItem('availability').disabled = currentAccess?.profile.role === 'admin'; form.elements.namedItem('publication').disabled = currentAccess?.profile.role === 'admin';['ref', 'name', 'service', 'nationality', 'profession', 'age', 'experience', 'salary', 'religion', 'passportNumber', 'totalRecruitmentCost', 'languages', 'skills', 'availability', 'publication'].forEach(key => { const field = form.elements.namedItem(key); if (field) field.value = worker[key] ?? '' }); const photoPreview = document.querySelector('[data-worker-photo-preview]'); if (photoPreview) { photoPreview.src = worker.photoUrl || ''; photoPreview.hidden = !worker.photoUrl } document.querySelector('#workerModalTitle').textContent = `مراجعة بيانات ${worker.ref}`; document.querySelector('#workerFormSubmit').textContent = 'حفظ التعديلات'; bootstrap.Modal.getOrCreateInstance(document.querySelector('#workerModal')).show(); return } if (availabilityButton) { worker.availability = worker.availability === 'متاحة' ? 'تم الحجز' : 'متاحة'; saveState(); toast(worker.availability === 'تم الحجز' ? 'تم الحجز وإخفاء البطاقة من الموقع.' : 'أصبحت متاحة وستظهر في الموقع إذا كانت منشورة.') } else if (publishButton) { if (worker.publication !== 'منشورة' && (!worker.photoPath || !worker.name || !worker.age || !worker.nationality || worker.nationality === 'تحتاج مراجعة' || String(worker.experience ?? '').trim() === '' || !Number(worker.totalRecruitmentCost))) { toast('أكمل الصورة والاسم والعمر والجنسية والخبرة وسعر الاستقدام قبل النشر.'); return } worker.publication = worker.publication === 'منشورة' ? 'مسودة' : 'منشورة'; saveState(); toast('تم تحديث حالة النشر.') } else { worker.availability = 'مؤرشفة'; worker.publication = 'مسودة'; saveState(); toast('تمت أرشفة الملف.') } renderWorkers() });
    document.querySelector('#workerPhotoFile')?.addEventListener('change', event => { const file = event.target.files?.[0], preview = document.querySelector('[data-worker-photo-preview]'); if (!file || !preview) return; if (!file.type.startsWith('image/')) { event.target.value = ''; return } preview.src = URL.createObjectURL(file); preview.hidden = false });
    function imageBlobFromBase64(value) {
      const binary = atob(value || '');
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: 'image/jpeg' });
    }
    function clearExtractionHints() {
      document.querySelectorAll('[data-review-key]').forEach(field => {
        field.classList.remove('needs-review');
        const hint = field.querySelector('.field-confidence');
        if (hint) { hint.textContent = ''; hint.classList.remove('low'); }
      });
      const summary = document.querySelector('#cvReviewSummary');
      if (summary) { summary.replaceChildren(); summary.hidden = true; }
      const candidates = document.querySelector('#workerPhotoCandidates');
      if (candidates) { candidates.replaceChildren(); candidates.hidden = true; }
    }
    function renderExtractionReview(pending) {
      clearExtractionHints();
      const form = document.querySelector('#workerForm');
      const fieldMap = {
        name: ['name', 'workerName'], salary: ['salary', 'workerSalary'], nationality: ['nationality', 'workerNationality'],
        religion: ['religion', 'workerReligion'], age: ['age', 'workerAge'],
        job: ['profession', 'workerProfession'], passport_number: ['passportNumber', 'workerPassport'],
        experience: ['experience', 'workerExperience']
      };
      window.RakaezCVFormMapping?.applyExtractedFields(form, pending.fields || {});
      Object.entries(fieldMap).forEach(([source, [target, id]]) => {
        const input = document.getElementById(id);
        const value = pending.fields?.[source];
        const wrapper = document.querySelector('[data-review-key="' + source + '"]');
        const hint = wrapper?.querySelector('.field-confidence');
        if (!hint) return;
        const confidence = Number(pending.confidence?.[source] || 0);
        const missing = value == null || String(value).trim() === '';
        const original = pending.rawFields?.[source];
        const originalHint = original ? ' · القيمة الأصلية: ' + original : '';
        hint.textContent = (pending.extractionError ? 'اكتبي القيمة يدويًا؛ لم يكتمل الاستخراج.' : missing ? 'لم تُكتشف قيمة في السيرة.' : 'ثقة الاستخراج: ' + Math.round(confidence * 100) + '% · راجعي القيمة') + originalHint;
        const low = pending.extractionError || missing || confidence < 0.72;
        wrapper.classList.toggle('needs-review', low);
        hint.classList.toggle('low', low);
      });
      form.elements.namedItem('name').value = pending.fields?.name || '';
      form.elements.namedItem('service').value = 'الاستقدام';
      form.elements.namedItem('ref').value = pending.ref;
      form.elements.namedItem('availability').value = 'متاحة';
      form.elements.namedItem('publication').value = 'مسودة';
      form.elements.namedItem('totalRecruitmentCost').value = '';
      form.elements.namedItem('languages').value = '';
      form.elements.namedItem('skills').value = '';
      const summary = document.querySelector('#cvReviewSummary');
      const heading = document.createElement('strong');
      heading.textContent = pending.extractionError ? 'احتفظنا بملف PDF؛ أدخلي البيانات غير المستخرجة يدويًا.' : 'راجعي البيانات قبل تأكيد إنشاء ملف العاملة.';
      summary.append(heading);
      const notes = [];
      if (pending.extractionError) notes.push(pending.extractionError);
      else if (!pending.extracted) notes.push('لم تظهر بيانات كافية في الملف. الحقول غير المكتشفة بقيت فارغة.');
      (pending.warnings || []).forEach(note => notes.push(note));
      if (!String(form.elements.namedItem('name').value || '').trim()) notes.push('لم يُكتشف اسم واضح؛ راجعي السيرة وأدخليه يدويًا.');
      if (notes.length) {
        const list = document.createElement('ul');
        notes.forEach(note => { const item = document.createElement('li'); item.textContent = note; list.append(item); });
        summary.append(list);
      }
      summary.hidden = false;

      const photoBox = document.querySelector('#workerPhotoCandidates');
      const preview = document.querySelector('[data-worker-photo-preview]');
      preview.hidden = true;
      preview.removeAttribute('src');
      const photoInput = document.querySelector('#workerPhotoFile');
      photoInput.value = '';
      const validPhotos = (pending.photos || []).filter(photo => photo.data && photo.id);
      if (pending.localPhotoBlob) {
        preview.src = URL.createObjectURL(pending.localPhotoBlob);
        preview.hidden = false;
      }
      if (validPhotos.length) {
        validPhotos.forEach(photo => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'photo-candidate';
          button.dataset.photoCandidate = photo.id;
          button.setAttribute('aria-pressed', String(photo.id === pending.selectedPhotoId));
          const image = document.createElement('img');
          image.src = 'data:image/jpeg;base64,' + photo.data;
          image.alt = 'صورة مرشحة من صفحة ' + String(photo.page || 1);
          const label = document.createElement('strong');
          label.textContent = photo.type === 'portrait' ? 'صورة شخصية' : photo.type === 'full_body' ? 'صورة كاملة' : photo.type === 'passport_copy' ? 'صورة من مستند سفر' : 'صورة مرشحة';
          const score = document.createElement('small');
          score.textContent = 'الصفحة ' + String(photo.page || 1) + ' · ثقة ' + Math.round(Number(photo.score || 0) * 100) + '%';
          button.append(image, label, score);
          photoBox.append(button);
        });
        photoBox.hidden = false;
        const chosen = validPhotos.find(photo => photo.id === pending.selectedPhotoId);
        if (chosen) { preview.src = 'data:image/jpeg;base64,' + chosen.data; preview.hidden = false; }
      }
      const pdfButton = document.querySelector('#workerProfilePdfButton');
      if (pdfButton) pdfButton.hidden = false;
    }

    async function downloadWorkerProfilePdf() {
      const form = document.querySelector('#workerForm');
      if (!form) return;
      const value = name => String(form.elements.namedItem(name)?.value || '').trim();
      const escapeHtml = input => String(input || '—').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
      const fields = [
        ['الاسم', value('name')], ['الجنسية', value('nationality')], ['المهنة', value('profession')],
        ['العمر', value('age')], ['الخبرة', value('experience') ? `${value('experience')} سنة` : '—'],
        ['الديانة', value('religion')], ['الراتب', value('salary') ? `${value('salary')} ريال` : '—'],
        ['إجمالي سعر الاستقدام', value('totalRecruitmentCost') ? `${value('totalRecruitmentCost')} ريال` : '—'],
        ['نوع الخدمة', value('service')], ['اللغات', value('languages')], ['المهارات', value('skills')],
        ['الرقم المرجعي', value('ref')],
      ];
      const preview = document.querySelector('[data-worker-photo-preview]');
      const photoUrl = preview && !preview.hidden ? preview.src : '';
      const logoUrl = new URL('../assets/images/logo-mark-refined.png', document.baseURI).href;
      if (typeof window.html2pdf !== 'function') { toast('تعذر تحميل أداة إنشاء PDF. حدّثي الصفحة ثم حاولي مرة أخرى.'); return; }
      const button = document.querySelector('#workerProfilePdfButton');
      const originalLabel = button?.textContent || '';
      if (button) { button.disabled = true; button.textContent = 'جارٍ تجهيز التنزيل…'; }
      const sheet = document.createElement('main');
      sheet.className = 'worker-profile-pdf';
      sheet.dir = 'rtl';
      sheet.lang = 'ar';
      const rows = fields.map(([label, fieldValue], index) => `<div class="worker-pdf-field ${index === 7 ? 'worker-pdf-price' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(fieldValue)}</strong></div>`).join('');
      const date = new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(new Date());
      sheet.innerHTML = `<header class="worker-pdf-header"><div class="worker-pdf-brand"><img src="${escapeHtml(logoUrl)}" alt="شعار الركائز البشرية"><div><span class="worker-pdf-eyebrow">خدمات البيت أقرب لك</span><h1>الركائز البشرية للاستقدام</h1><p>ملف بيانات مرشحة للعمل المنزلي</p></div></div><span class="worker-pdf-doc-tag">ملف مرشحة</span></header><section class="worker-pdf-content"><div class="worker-pdf-profile">${photoUrl ? `<img class="worker-pdf-photo" src="${escapeHtml(photoUrl)}" alt="صورة المرشحة">` : '<div class="worker-pdf-photo worker-pdf-photo-empty">الركائز<br>البشرية</div>'}<div class="worker-pdf-profile-info"><span class="worker-pdf-eyebrow">بيانات الملف</span><h2>${escapeHtml(value('name'))}</h2><p>${escapeHtml([value('nationality'), value('profession')].filter(Boolean).join('  ·  ') || 'بيانات قيد المراجعة')}</p><span class="worker-pdf-reference">الرقم المرجعي: ${escapeHtml(value('ref'))}</span></div><div class="worker-pdf-seal">ملف<br>معتمد<br>للمراجعة</div></div><div class="worker-pdf-section-title"><span>ملخص البيانات</span><i></i></div><div class="worker-pdf-grid">${rows}</div><footer class="worker-pdf-footer"><span>شركة الركائز البشرية للاستقدام</span><span>بيانات داخلية · ${escapeHtml(date)}</span></footer></section>`;
      Object.assign(sheet.style, { position: 'fixed', left: '-10000px', top: '0', zIndex: '-1' });
      document.body.append(sheet);
      try {
        await Promise.all([...sheet.querySelectorAll('img')].map(image => image.decode().catch(() => {})));
        await window.html2pdf().set({
          margin: [8, 9, 8, 9],
          filename: `alrakayiz-${(value('ref') || 'worker').replace(/[^a-z0-9_-]/gi, '-')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        }).from(sheet).save();
        toast('تم تنزيل ملف PDF.');
      } catch (error) {
        console.error('Worker profile PDF download failed', error);
        toast('لم نتمكن من إنشاء PDF. حاولي مرة أخرى.');
      } finally {
        sheet.remove();
        if (button) { button.disabled = false; button.textContent = originalLabel; }
      }
    }

    document.querySelector('#workerProfilePdfButton')?.addEventListener('click', downloadWorkerProfilePdf);

    document.querySelector('#workerPhotoCandidates')?.addEventListener('click', event => {
      const button = event.target.closest('[data-photo-candidate]');
      if (!button || !activeCvUpload) return;
      activeCvUpload.selectedPhotoId = button.dataset.photoCandidate;
      document.querySelectorAll('[data-photo-candidate]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const photo = activeCvUpload.photos.find(item => item.id === activeCvUpload.selectedPhotoId);
      const preview = document.querySelector('[data-worker-photo-preview]');
      if (photo && preview) { preview.src = 'data:image/jpeg;base64,' + photo.data; preview.hidden = false; }
      document.querySelector('#workerPhotoFile').value = '';
    });
    document.querySelector('#workerPhotoFile')?.addEventListener('change', event => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      const preview = document.querySelector('[data-worker-photo-preview]');
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
      if (activeCvUpload) activeCvUpload.selectedPhotoId = '';
      document.querySelectorAll('[data-photo-candidate]').forEach(item => item.setAttribute('aria-pressed', 'false'));
    });

    document.querySelector('#workerForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      data.publication = form.elements.namedItem('publication').value || 'مسودة';
      data.availability = form.elements.namedItem('availability').value || 'متاحة';
      const editRef = document.querySelector('#workerEditRef').value;
      const photoFile = document.querySelector('#workerPhotoFile')?.files?.[0];
      const button = document.querySelector('#workerFormSubmit');
      button.disabled = true;
      try {
        if (editRef) {
          const worker = state.workers.find(item => item.ref === editRef);
          if (!worker) return;
          if (photoFile && backend?.ready) {
            const compressed = await compressImage(photoFile), blob = await (await fetch(compressed)).blob();
            const path = currentUserId + '/' + worker.ref + '/' + Date.now() + '.jpg';
            const { error } = await backend.client.storage.from('worker-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
            if (error) throw error;
            worker.photoPath = path;
            worker.photoUrl = URL.createObjectURL(blob);
          }
          if (data.publication === 'منشورة' && (!worker.photoPath || !data.name || !data.age || !data.nationality || String(data.experience ?? '').trim() === '' || !Number(data.totalRecruitmentCost))) {
            toast('أكمل الصورة والاسم والعمر والجنسية والخبرة وسعر الاستقدام قبل النشر.');
            return;
          }
          Object.assign(worker, data, { ref: editRef, totalRecruitmentCost: data.totalRecruitmentCost ? Number(data.totalRecruitmentCost) : '', ageValue: numericValue(data.age), salaryValue: numericValue(data.salary), experienceValue: numericValue(data.experience) });
          saveState();
          renderWorkers();
          refreshCvRecords();
          form.reset();
          clearExtractionHints();
          bootstrap.Modal.getOrCreateInstance(document.querySelector('#workerModal')).hide();
          toast('تم تحديث بيانات الملف المرتبط بالسيرة.');
          return;
        }

        if (!activeCvUpload) { toast('ارفعي السيرة الذاتية أولًا.'); return; }
        if (data.publication === 'منشورة' && (!data.name || !data.age || !data.nationality || !data.profession || String(data.experience ?? '').trim() === '' || !data.totalRecruitmentCost)) {
          toast('أكملي الاسم والعمر والجنسية والمهنة والخبرة والسعر قبل نشر البطاقة.');
          return;
        }
        if (currentAccess?.profile.role === 'admin' && data.publication !== 'مسودة') {
          toast('صلاحية الأدمن تحفظ الملفات كمسودة فقط.');
          return;
        }

        const pending = activeCvUpload;
        let photoBlob = null;
        if (photoFile) {
          const compressed = await compressImage(photoFile);
          photoBlob = await (await fetch(compressed)).blob();
        } else if (pending.selectedPhotoId) {
          const selected = pending.photos.find(item => item.id === pending.selectedPhotoId);
          if (selected?.data) photoBlob = imageBlobFromBase64(selected.data);
        } else if (pending.localPhotoBlob) photoBlob = pending.localPhotoBlob;

        let photoPath = pending.photoPath || '';
        let photoUrl = '';
        if (backend?.ready && photoBlob && !photoPath) {
          const photoName = pending.cvId + '.jpg';
          photoPath = currentUserId + '/' + pending.ref + '/' + photoName;
          const upload = await backend.client.storage.from('worker-photos').upload(photoPath, photoBlob, { contentType: 'image/jpeg', upsert: false });
          if (upload.error) throw upload.error;
          pending.photoPath = photoPath;
        }
        if (photoBlob) photoUrl = URL.createObjectURL(photoBlob);

        const worker = {
          ref: pending.ref, cvId: pending.cvId, cvPath: pending.cvPath || '', cvFileName: pending.fileName,
          createdBy: currentUserId, name: String(data.name || '').trim(), service: data.service || 'الاستقدام',
          nationality: String(data.nationality || '').trim(), profession: String(data.profession || '').trim(),
          age: String(data.age || '').trim(), salary: String(data.salary || '').trim(), religion: String(data.religion || '').trim(),
          passportNumber: String(data.passportNumber || '').trim(), experience: String(data.experience || '').trim(),
          languages: String(data.languages || '').trim(), skills: String(data.skills || '').trim(),
          totalRecruitmentCost: data.totalRecruitmentCost ? Number(data.totalRecruitmentCost) : '',
          photoPath, photoUrl, availability: data.availability || 'متاحة', publication: data.publication || 'مسودة',
          extracted: Boolean(pending.extracted), rawFields: { ...(pending.rawFields || {}) },
          ageValue: numericValue(data.age), salaryValue: numericValue(data.salary), experienceValue: numericValue(data.experience)
        };

        if (backend?.ready) {
          const payload = {
            ref: worker.ref, name: worker.name, service: worker.service, nationality: worker.nationality,
            profession: worker.profession, age: worker.age, salary: worker.salary, religion: worker.religion,
            passport_number: worker.passportNumber, experience: worker.experience, languages: worker.languages,
            nationality_raw: worker.rawFields.nationality || '', job_raw: worker.rawFields.job || '',
            age_raw: worker.rawFields.age || '', salary_raw: worker.rawFields.salary || '',
            religion_raw: worker.rawFields.religion || '', passport_number_raw: worker.rawFields.passport_number || '',
            experience_raw: worker.rawFields.experience || '', age_value: worker.ageValue, salary_value: worker.salaryValue,
            experience_value: worker.experienceValue,
            skills: worker.skills, photo_path: worker.photoPath || null,
            total_recruitment_cost: worker.totalRecruitmentCost === '' ? null : worker.totalRecruitmentCost,
            availability: worker.availability, publication: worker.publication, cv_path: worker.cvPath,
            cv_file_name: worker.cvFileName, extracted: worker.extracted, created_by: currentUserId
          };
          const { data: inserted, error } = await backend.client.from('workers').insert(payload).select('*').single();
          if (error) {
            if (/salary|religion|passport_number|_raw|_value/i.test(error.message || '')) {
              status.textContent = 'لم يُحفظ الملف بعد. شغّلي ملفات SQL الخاصة ببيانات السيرة في SQL Editor، ثم أعيدي التأكيد. بقيت السيرة والصورة في التخزين الخاص.';
            } else status.textContent = 'تعذر حفظ ملف العاملة في قاعدة البيانات. بقيت السيرة والصورة في التخزين الخاص؛ أعيدي المحاولة بعد التحقق من الاتصال والصلاحيات.';
            throw error;
          }
          Object.assign(worker, { id: inserted.id, created_at: inserted.created_at, updated_at: inserted.updated_at });
          pending.photoPath = photoPath;
        } else {
          await cvDbAction('put', { id: pending.cvId, fileName: pending.fileName, blob: pending.file, photoBlob });
        }

        state.workers.unshift(worker);
        state.cvRecords.unshift({ id: pending.cloud ? pending.cvPath : pending.cvId, fileName: pending.fileName, ref: pending.ref, date: new Date().toLocaleDateString('ar-SA'), extracted: pending.extracted, photoExtracted: Boolean(photoBlob), cloud: Boolean(pending.cloud) });
        saveState(false);
        renderWorkers();
        refreshCvRecords();
        status.textContent = 'تم حفظ المسودة ' + pending.ref + (pending.extractionError ? '؛ يمكنك استكمال البيانات يدويًا.' : ' بعد مراجعتك.');
        activeCvUpload = null;
        document.querySelector('#workerProfilePdfButton').hidden = true;
        form.reset();
        clearExtractionHints();
        document.querySelector('#workerPhotoFile').value = '';
        document.querySelector('#workerEditRef').value = '';
        bootstrap.Modal.getOrCreateInstance(document.querySelector('#workerModal')).hide();
        toast('تم تأكيد البيانات وحفظ مسودة العاملة.');
      } catch (error) {
        console.error('Worker CV confirmation failed', error);
        if (error.message === 'supabase_upload_failed') status.textContent = 'تعذر حفظ السيرة في التخزين الخاص. لم يُنشأ سجل العاملة.';
        else if (!status.textContent.startsWith('لم يُحفظ الملف بعد')) status.textContent = 'تعذر حفظ المسودة. بقيت السيرة المرفوعة وبيانات المراجعة كما هي؛ أعيدي المحاولة.';
      } finally {
        button.disabled = false;
      }
    });

  const cvInput = document.querySelector('#cvFiles'), cvBody = document.querySelector('#cvTableBody');
  if (cvInput && cvBody) {
    const status = document.querySelector('#cvProcessingStatus');
    function renderCvRecords() { const rows = state.cvRecords; document.querySelector('[data-cv-count]').textContent = `${rows.length} ملفات`; cvBody.innerHTML = rows.length ? rows.map(record => { const worker = state.workers.find(w => w.ref === record.ref); return `<tr><td><strong class="cell-title">${esc(record.fileName)}</strong></td><td>${esc(worker?.name || 'يحتاج مراجعة')}</td><td class="record-id">${esc(record.ref)}</td><td>${esc(worker?.nationality || 'تحتاج مراجعة')}</td><td>${esc(worker?.profession || 'عاملة منزلية')}</td><td><span class="status-badge ${record.extracted ? 'status-available' : 'status-progress'}">${record.extracted ? 'اكتمل الاستخراج' : 'تحتاج مراجعة'}</span></td><td>${esc(record.date)}</td><td><div class="row-actions"><button class="row-action" data-cv-open="${esc(record.id)}">مراجعة</button><button class="row-action" data-cv-download="${esc(record.id)}">تنزيل</button>${currentAccess?.profile.role === 'admin' ? '' : `<button class="row-action" data-cv-delete="${esc(record.id)}">حذف</button>`}</div></td></tr>` }).join('') : '<tr><td colspan="8"><div class="empty-state"><strong>مكتبة السير الذاتية فارغة</strong>ارفع PDF لإنشاء بروفايل وربط السيرة به.</div></td></tr>' }
    refreshCvRecords = renderCvRecords;
    cvInput.addEventListener('change', async () => {
      const file = cvInput.files?.[0];
      if (!file) return;
      document.querySelector('#workerProfilePdfButton').hidden = true;
      const status = document.querySelector('#cvProcessingStatus');
      const stamp = Date.now();
      try {
        let pending;
        if (backend?.ready && window.RakaezCVExtraction) {
          pending = await window.RakaezCVExtraction.extract(file, {
            client: backend.client,
            userId: currentUserId,
            onStatus: message => { status.textContent = message; }
          });
        } else {
          if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 15 * 1024 * 1024) throw new Error(file.size > 15 * 1024 * 1024 ? 'file_too_large' : 'invalid_pdf');
          const prefix = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
          if (!new TextDecoder('ascii').decode(prefix).includes('%PDF-')) throw new Error('invalid_pdf');
          const ref = 'WK-' + String(stamp).slice(-7) + Math.floor(Math.random() * 90 + 10);
          const cvId = 'CV-' + stamp + '-' + Math.random().toString(36).slice(2, 7);
          let text = '', localFields = {}, localPhotoBlob = null;
          try { text = await extractPdfText(file); localFields = parsePdfFields(text, file.name, ref); } catch { }
          try { localPhotoBlob = await extractPdfPhoto(file); } catch { }
          await cvDbAction('put', { id: cvId, fileName: file.name, blob: file, photoBlob: localPhotoBlob });
          pending = {
            ref, cvId, fileName: file.name, file, cloud: false, cvPath: '', extracted: false,
            fields: { name: localFields.name || '', salary: '', nationality: localFields.nationality || '', religion: '', age: localFields.age || '', job: localFields.profession || '', passport_number: '', experience: localFields.experience || '' },
            rawFields: { name: localFields.name || '', salary: '', nationality: localFields.nationality || '', religion: '', age: localFields.age || '', job: localFields.profession || '', passport_number: '', experience: localFields.experience || '' },
            confidence: {}, warnings: [], photos: [], selectedPhotoId: '', localPhotoBlob,
            extractionError: 'تحليل Python يحتاج نشر خدمة الاستخراج وربط حساب موظف. راجعي القيم أو أدخليها يدويًا.'
          };
        }
        pending.createdBy = currentUserId;
        if (!pending.file) pending.file = file;
        if (!pending.selectedPhotoId) pending.selectedPhotoId = pending.selectedPhoto || '';
        window.RakaezCVFormMapping?.resetReviewEdits(document.querySelector('#workerForm'));
        activeCvUpload = pending;
        renderExtractionReview(pending);
        document.querySelector('#workerEditRef').value = '';
        document.querySelector('#workerModalTitle').textContent = 'مراجعة السيرة ' + pending.ref;
        document.querySelector('#workerFormSubmit').textContent = 'تأكيد وحفظ المسودة';
        document.querySelector('#workerAvailability').disabled = false;
        document.querySelector('#workerPublish').disabled = false;
        status.textContent = pending.extractionError ? pending.extractionError + ' احتفظنا بالسيرة ويمكنك المتابعة يدويًا.' : 'اكتمل التحليل. راجعي الحقول والصورة ثم أكدي الحفظ.';
        bootstrap.Modal.getOrCreateInstance(document.querySelector('#workerModal')).show();
      } catch (error) {
        console.error('CV upload/extraction failed', error);
        status.textContent = window.RakaezCVExtraction?.messageFor(error.message) || 'تعذر قراءة ملف PDF. اختاري ملفًا صالحًا وحاولي مجددًا.';
      } finally {
        cvInput.value = '';
      }
    });
    cvBody.addEventListener('click', async event => { const open = event.target.closest('[data-cv-open]'), download = event.target.closest('[data-cv-download]'), remove = event.target.closest('[data-cv-delete]'); if (open || download) { try { const id = open?.dataset.cvOpen || download?.dataset.cvDownload, record = state.cvRecords.find(item => item.id === id); let url; if (record?.cloud) { const { data, error } = await backend.client.storage.from('worker-cvs').createSignedUrl(id, 60); if (error) throw error; url = data.signedUrl } else { const file = await cvDbAction('get', id); if (!file?.blob) throw new Error(); url = URL.createObjectURL(file.blob) } if (open) { const preview = window.open(url, '_blank'); if (!preview) { const link = document.createElement('a'); link.href = url; link.download = record?.fileName || 'cv.pdf'; link.click() } } else { const link = document.createElement('a'); link.href = url; link.download = record?.fileName || 'cv.pdf'; link.click() } if (!record?.cloud) setTimeout(() => URL.revokeObjectURL(url), 60000) } catch { toast('تعذر فتح السيرة. تحقق من التخزين الخاص والصلاحية.') } } if (remove) { const id = remove.dataset.cvDelete, record = state.cvRecords.find(item => item.id === id), worker = state.workers.find(item => item.cvId === id || item.cvPath === id); state.cvRecords = state.cvRecords.filter(item => item.id !== id); state.workers = state.workers.filter(item => item.cvId !== id && item.cvPath !== id); try { if (record?.cloud) { await backend.client.from('workers').delete().eq('ref', record.ref); await backend.client.storage.from('worker-cvs').remove([id]); if (worker?.photoPath) await backend.client.storage.from('worker-photos').remove([worker.photoPath]) } else await cvDbAction('delete', id) } catch { } saveState(); renderCvRecords(); refreshWorkers(); toast('تم حذف السيرة والبروفايل المرتبطين بها.') } });
    renderCvRecords();
  }
  }

  // Request follow-up workflow, with the contact status visible in the table.
  const requestBody = document.querySelector('#requestTableBody');
  if (requestBody) {
    const search = document.querySelector('#requestSearch'), service = document.querySelector('#requestServiceFilter'), status = document.querySelector('#requestStatusFilter');
    const statusClass = value => ['مكتمل', 'رد العميل'].includes(value) ? 'status-complete' : value === 'معتذر عنه' ? 'status-rejected' : value === 'تم التواصل ولم يرد' ? 'status-reserved' : 'status-progress';
    function renderRequests() { const q = (search.value || '').trim().toLowerCase(); const rows = state.requests.filter(r => (!q || `${r.id} ${r.mobile} ${r.name} ${r.worker?.name || ''} ${r.workerRef || ''}`.toLowerCase().includes(q)) && (!service.value || r.service === service.value) && (!status.value || r.status === status.value)); requestBody.innerHTML = rows.length ? rows.map(r => `<tr><td class="record-id">${esc(r.id)}</td><td><span class="cell-title">${esc(r.name || 'عميلة')}</span><small class="cell-sub">${esc(r.mobile || '')}</small></td><td><span class="cell-title">${esc(r.service)}</span></td><td>${esc(r.preference)}</td><td>${r.worker ? `<span class="cell-title">${esc(r.worker.name || 'عاملة')}</span><small class="cell-sub">${esc(r.workerRef || r.worker.ref)}</small>` : r.workerRef ? `<span class="cell-sub">مرجع ${esc(r.workerRef)}</span>` : '—'}</td><td>${esc(r.date)}</td><td><span class="status-badge ${statusClass(r.status)}">${esc(r.status)}</span></td><td>${esc(r.assignee || 'غير معين')}</td><td><button class="row-action" data-request-open="${esc(r.id)}">التفاصيل</button></td></tr>`).join('') : '<tr><td colspan="9"><div class="empty-state"><strong>لا توجد طلبات مطابقة</strong>جرّب تغيير خيارات التصفية.</div></td></tr>'; document.querySelector('[data-request-count]').textContent = `عرض ${rows.length} من ${state.requests.length} طلبات`; document.querySelector('[data-requests-new]').textContent = state.requests.filter(r => ['جديد', 'لم يتم التواصل'].includes(r.status)).length; document.querySelector('[data-requests-progress]').textContent = state.requests.filter(r => ['تم التواصل', 'تم التواصل ولم يرد', 'رد العميل'].includes(r.status)).length; document.querySelector('[data-requests-complete]').textContent = state.requests.filter(r => r.status === 'مكتمل').length }
    refreshRequests = renderRequests;
    [search, service, status].forEach(el => el?.addEventListener('input', renderRequests));[service, status].forEach(el => el?.addEventListener('change', renderRequests));
    requestBody.addEventListener('click', async event => { const button = event.target.closest('[data-request-open]'); if (!button) return; const request = state.requests.find(r => r.id === button.dataset.requestOpen); if (!request) return; document.querySelector('#detailRequestId').value = request.id; document.querySelector('[data-detail-ref]').textContent = request.id; document.querySelector('[data-detail-name]').textContent = request.name || '—'; document.querySelector('[data-detail-mobile]').textContent = request.mobile || '—'; document.querySelector('[data-detail-service]').textContent = request.service; document.querySelector('[data-detail-preference]').textContent = request.preference; document.querySelector('#detailStatus').value = request.status; document.querySelector('#detailAssignee').value = backend?.ready ? (request.assigneeId || '') : (request.assignee || 'غير معين'); document.querySelector('#detailNotes').value = request.internalNotes || request.notes || ''; const worker = request.worker, panel = document.querySelector('#requestWorkerCard'), workerName = document.querySelector('[data-detail-worker-name]'), workerRef = document.querySelector('[data-detail-worker-ref]'), photo = document.querySelector('[data-detail-worker-photo]'), cv = document.querySelector('[data-detail-worker-cv]'), cvStatus = document.querySelector('[data-detail-worker-cv-status]'); panel.hidden = !worker && !request.workerRef; photo.hidden = true; if (photo.dataset.objectUrl) URL.revokeObjectURL(photo.dataset.objectUrl); photo.dataset.objectUrl = ''; photo.removeAttribute('src'); cv.hidden = true; cv.removeAttribute('href'); cvStatus.hidden = true; cvStatus.textContent = ''; bootstrap.Modal.getOrCreateInstance(document.querySelector('#requestModal')).show(); if (panel.hidden) { workerName.textContent = '—'; workerRef.textContent = '' } else { workerName.textContent = worker?.name || 'بيانات العاملة غير متاحة'; workerRef.textContent = `الرقم المرجعي: ${worker?.ref || request.workerRef}`; if (worker?.photoUrl) { photo.src = worker.photoUrl; photo.hidden = false } else if (worker?.photoPath && backend?.ready) { const { data, error } = await backend.client.storage.from('worker-photos').download(worker.photoPath); if (!error && data) { photo.dataset.objectUrl = URL.createObjectURL(data); photo.src = photo.dataset.objectUrl; photo.hidden = false } } if (worker?.cvPath && backend?.ready) { cvStatus.hidden = false; cvStatus.textContent = `جارٍ تجهيز ملف ${worker.cvFileName || 'السيرة الذاتية'}…`; const { data, error } = await backend.client.storage.from('worker-cvs').createSignedUrl(worker.cvPath, 300); if (!error && data?.signedUrl) { cv.href = data.signedUrl; cv.download = worker.cvFileName || 'cv.pdf'; cv.hidden = false; cvStatus.hidden = true } else cvStatus.textContent = 'تعذر فتح ملف PDF. تحققي من صلاحية حساب الموظف.' } else if (worker?.cvPath) { cvStatus.hidden = false; cvStatus.textContent = 'ملف PDF متاح في بيئة الموقع المحلية فقط.' } else if (worker) { cvStatus.hidden = false; cvStatus.textContent = 'لا يوجد ملف PDF مرتبط بهذا الملف.' } } });
    document.querySelector('#requestUpdateForm')?.addEventListener('submit', event => { event.preventDefault(); const id = document.querySelector('#detailRequestId').value, request = state.requests.find(r => r.id === id); if (!request) return; request.status = document.querySelector('#detailStatus').value; const selected = document.querySelector('#detailAssignee').value, actorIsAdmin = currentAccess?.profile.role === 'admin', nextAssignee = actorIsAdmin ? currentUserId : (selected || request.assigneeId || currentUserId); request.assigneeId = backend?.ready ? nextAssignee : ''; request.assignee = backend?.ready ? (state.staffDirectory.find(staff => staff.user_id === nextAssignee)?.full_name || 'غير معين') : selected || request.assignee || 'غير معين'; request.internalNotes = document.querySelector('#detailNotes').value; saveState(); renderRequests(); refreshDashboard(); bootstrap.Modal.getOrCreateInstance(document.querySelector('#requestModal')).hide(); toast(request.assignee !== 'غير معين' ? `تم تحديث الطلب وتسجيل المسؤول: ${request.assignee}` : 'تم حفظ تحديث المتابعة.') });
    document.querySelector('[data-requests-export]')?.addEventListener('click', () => downloadCsv('requests-demo.csv', ['رقم الطلب', 'الاسم', 'الجوال', 'الخدمة', 'التفضيل', 'التاريخ', 'حالة التواصل', 'المسؤول', 'ملاحظات'], state.requests.map(r => [r.id, r.name, r.mobile, r.service, r.preference, r.date, r.status, r.assignee, r.notes])));
    renderRequests();
    const requestMode = document.querySelector('[data-request-mode]'), requestBadge = document.querySelector('[data-request-mode-badge]'), requestFooter = document.querySelector('[data-request-footer]'), requestNotice = document.querySelector('[data-request-notice]');
    if (requestMode) requestMode.textContent = backend?.ready ? 'متصل بقاعدة البيانات' : 'تجربة محلية';
    if (requestBadge) { requestBadge.textContent = backend?.ready ? 'مباشر' : 'محلي'; requestBadge.className = `status-badge ${backend?.ready ? 'status-available' : 'status-draft'}` }
    if (requestFooter) requestFooter.textContent = backend?.ready ? 'تُحفظ الطلبات في قاعدة بيانات الموقع.' : 'الطلبات التجريبية محفوظة في هذا المتصفح فقط.';
    if (requestNotice) requestNotice.lastElementChild.textContent = backend?.ready ? 'طلبات العملاء الواردة تظهر هنا مع بيانات العاملة المختارة وملفها الخاص للموظفين المخولين.' : 'هذه نسخة محلية تجريبية؛ لن تصل الطلبات إلى لوحة الإدارة المنشورة حتى يتصل الموقع بقاعدة البيانات.';
  }

  const complaintBody = document.querySelector('#complaintsTableBody');
  if (complaintBody) {
    const search = document.querySelector('#complaintSearch'), statusFilter = document.querySelector('#complaintStatusFilter');
    function renderComplaints() { const q = (search?.value || '').trim().toLowerCase(), rows = state.complaints.filter(c => (!q || `${c.id} ${c.phone} ${c.complaintText}`.toLowerCase().includes(q)) && (!statusFilter?.value || c.status === statusFilter.value)); complaintBody.innerHTML = rows.length ? rows.map(c => `<tr><td class="record-id">${esc(c.id)}</td><td>${esc(c.date)}</td><td dir="ltr">${esc(c.phone)}</td><td><span class="cell-title">${esc(c.complaintText.slice(0, 120))}</span></td><td><span class="status-badge ${c.status === 'تم الحل' ? 'status-complete' : c.status === 'تعذر التواصل' ? 'status-rejected' : c.status === 'جديدة' ? 'status-progress' : 'status-reserved'}">${esc(c.status)}</span></td><td>${esc(c.assignee || 'غير معين')}</td><td><button type="button" class="row-action" data-complaint-open="${esc(c.id)}">متابعة</button></td></tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><strong>لا توجد شكاوى مطابقة</strong>ستظهر الشكاوى الجديدة التي يرسلها العملاء من الشات بوت هنا.</div></td></tr>'; const fresh = state.complaints.filter(c => c.status === 'جديدة').length; document.querySelector('[data-complaint-count]').textContent = `عرض ${rows.length} من ${state.complaints.length} شكاوى`; document.querySelector('[data-complaints-new]').textContent = fresh; document.querySelector('[data-complaints-progress]').textContent = state.complaints.filter(c => ['تم التواصل', 'جاري الحل'].includes(c.status)).length; document.querySelector('[data-complaints-resolved]').textContent = state.complaints.filter(c => c.status === 'تم الحل').length }
    refreshComplaints = renderComplaints; search?.addEventListener('input', renderComplaints); statusFilter?.addEventListener('change', renderComplaints);
    complaintBody.addEventListener('click', event => { const button = event.target.closest('[data-complaint-open]'); if (!button) return; const complaint = state.complaints.find(c => c.id === button.dataset.complaintOpen); if (!complaint) return; document.querySelector('#detailComplaintId').value = complaint.id; document.querySelector('[data-complaint-ref]').textContent = complaint.id; const phone = document.querySelector('[data-complaint-phone]'); phone.textContent = complaint.phone; phone.href = `tel:${complaint.phone.replace(/[^+\d]/g, '')}`; document.querySelector('[data-complaint-date]').textContent = complaint.date; document.querySelector('[data-complaint-text]').textContent = complaint.complaintText; document.querySelector('#complaintStatus').value = complaint.status; document.querySelector('#complaintAssignee').value = backend?.ready ? (complaint.assigneeId || '') : (complaint.assignee || ''); document.querySelector('#complaintNotes').value = complaint.internalNotes || ''; bootstrap.Modal.getOrCreateInstance(document.querySelector('#complaintModal')).show() });
    document.querySelector('#complaintUpdateForm')?.addEventListener('submit', event => { event.preventDefault(); const id = document.querySelector('#detailComplaintId').value, complaint = state.complaints.find(c => c.id === id); if (!complaint) return; complaint.status = document.querySelector('#complaintStatus').value; const selected = document.querySelector('#complaintAssignee').value, actorIsAdmin = currentAccess?.profile.role === 'admin', nextAssignee = actorIsAdmin ? currentUserId : (selected || complaint.assigneeId || currentUserId); complaint.assigneeId = backend?.ready ? nextAssignee : ''; complaint.assignee = backend?.ready ? (state.staffDirectory.find(staff => staff.user_id === nextAssignee)?.full_name || 'غير معين') : selected || complaint.assignee || 'غير معين'; complaint.internalNotes = document.querySelector('#complaintNotes').value; saveState(); renderComplaints(); refreshDashboard(); bootstrap.Modal.getOrCreateInstance(document.querySelector('#complaintModal')).hide(); toast(complaint.assignee !== 'غير معين' ? `تم تحديث الشكوى وتسجيل المسؤول: ${complaint.assignee}` : 'تم حفظ تحديث الشكوى.') });
    renderComplaints();
  }
})();













