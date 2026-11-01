(() => {
  const config = window.RAKAEZ_SUPABASE_CONFIG;
  const status = document.querySelector('#notifyStatus');
  const login = document.querySelector('#notifyLogin');
  const composer = document.querySelector('#notifyComposer');
  const form = document.querySelector('#notifyForm');
  if (!config?.url || !config?.anonKey || !window.supabase?.createClient) {
    status.textContent = 'إعداد اتصال Supabase غير مكتمل.';
    status.classList.add('error');
    return;
  }
  const client = window.supabase.createClient(config.url, config.anonKey);

  const showStatus = (text, error = false) => {
    status.textContent = text;
    status.classList.toggle('error', error);
  };

  async function displayAdmin(session) {
    if (!session) return false;
    const { data: profile, error } = await client.from('employee_profiles').select('full_name,role,active').eq('user_id', session.user.id).maybeSingle();
    if (error || !profile?.active || profile.role !== 'super_admin') {
      await client.auth.signOut();
      showStatus('هذه الصفحة متاحة لمدير النظام فقط.', true);
      return false;
    }
    login.hidden = true;
    composer.hidden = false;
    document.querySelector('#notifyUserName').textContent = `مسجل الدخول: ${profile.full_name}`;
    showStatus('يمكنك الآن إرسال تنبيه للمشتركين.');
    return true;
  }

  client.auth.getSession().then(({ data }) => displayAdmin(data.session));
  login.addEventListener('submit', async event => {
    event.preventDefault();
    const button = login.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus('جارٍ التحقق من الحساب…');
    const { data, error } = await client.auth.signInWithPassword({ email: login.elements.email.value.trim(), password: login.elements.password.value });
    button.disabled = false;
    if (error) { showStatus('تعذر تسجيل الدخول. تحققي من البريد وكلمة المرور.', true); return }
    await displayAdmin(data.session);
  });

  document.querySelector('#notifyLogout').addEventListener('click', () => client.auth.signOut().then(() => { composer.hidden = true; login.hidden = false; showStatus('تم تسجيل الخروج.') }));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const { data } = await client.auth.getSession();
    if (!data.session) { await displayAdmin(null); showStatus('انتهت الجلسة. سجّلي الدخول مرة أخرى.', true); return }
    button.disabled = true;
    showStatus('جارٍ إرسال التنبيه…');
    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ title: form.elements.title.value, body: form.elements.body.value, url: form.elements.url.value, topic: form.elements.topic.value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === 'push_not_configured' ? 'إعداد مفاتيح الإشعارات غير مكتمل في Vercel.' : result.error === 'super_admin_required' ? 'الحساب لا يملك صلاحية مدير النظام.' : 'تعذر إرسال التنبيه.');
      showStatus(result.total ? `تم إرسال التنبيه إلى ${result.sent} جهازًا. تعذر الإرسال إلى ${result.failed} جهاز.` : 'لا يوجد مستخدمون مفعّلون للتنبيهات حتى الآن.');
      form.elements.body.value = '';
    } catch (error) {
      showStatus(error.message || 'تعذر الاتصال بخدمة التنبيهات.', true);
    } finally { button.disabled = false }
  });
})();
