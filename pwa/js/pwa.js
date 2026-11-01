(() => {
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const appMode = document.body.classList.contains('pwa-app-shell');
  let installPrompt = null;
  let registration = null;
  let toastTimer = 0;
  let welcomeScheduling = false;
  let welcomeScheduled = false;

  const root = document.createElement('div');
  const fallbackActions = appMode ? '' : `<div class="pwa-actions" aria-label="الركائز البشرية للاستقدام"><button type="button" class="pwa-action" data-pwa-install><span aria-hidden="true">⌂</span><span>تثبيت التطبيق</span></button><button type="button" class="pwa-action pwa-action-secondary" data-pwa-push><span aria-hidden="true">تنبيهات</span><span>تفعيل التنبيهات</span></button></div>`;
  const appInstallAction = appMode ? `<button type="button" class="pwa-install-fab" data-pwa-install aria-label="تثبيت تطبيق الركائز البشرية للاستقدام"><span class="pwa-install-fab-icon" aria-hidden="true">＋</span><span>تثبيت التطبيق</span></button>` : '';
  root.innerHTML = `${fallbackActions}${appInstallAction}
    <div class="pwa-toast" role="status" aria-live="polite" hidden></div>
    <div class="pwa-dialog-backdrop" data-pwa-dialog hidden><section class="pwa-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-dialog-title"><span class="pwa-dialog-mark" aria-hidden="true">⌂</span><h2 id="pwa-dialog-title">ثبتي تطبيق الركائز البشرية للاستقدام</h2><p data-pwa-dialog-copy>أضيفي التطبيق إلى الشاشة الرئيسية لفتح خدماتنا بسرعة.</p><ol data-pwa-ios-steps hidden><li>اضغطي زر المشاركة في المتصفح.</li><li>اختاري «إضافة إلى الشاشة الرئيسية».</li><li>اضغطي «إضافة».</li></ol><div class="pwa-dialog-actions"><button type="button" data-pwa-close>حسنًا</button><button type="button" data-pwa-dismiss>لاحقًا</button></div></section></div>
    <div class="pwa-optin-backdrop" data-push-optin hidden><section class="pwa-optin-card" role="dialog" aria-modal="true" aria-labelledby="push-optin-title"><span class="pwa-optin-mark" aria-hidden="true">✦</span><p class="pwa-optin-kicker">خلّيك قريبة من كل جديد</p><h2 id="push-optin-title">رسائل تهمّك من الركائز البشرية للاستقدام</h2><p>فعّلي التنبيهات عشان يوصلك جديد العاملات وباقات التأجير ورسائل خفيفة على مدار اليوم.</p><button type="button" class="pwa-optin-accept" data-pwa-push>فعّلي التنبيهات <span aria-hidden="true">←</span></button><button type="button" class="pwa-optin-later" data-push-dismiss>مو الحين</button></section></div>`;
  document.body.append(root);

  const installButtons = [...document.querySelectorAll('[data-pwa-install]')];
  const pushButtons = [...document.querySelectorAll('[data-pwa-push]')];
  const disableButton = document.querySelector('[data-pwa-disable]');
  const backdrop = root.querySelector('[data-pwa-dialog]');
  const pushOptin = root.querySelector('[data-push-optin]');
  const toast = root.querySelector('.pwa-toast');
  const showToast = message => { toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true }, 5200) };
  async function scheduleWelcome(subscription, installed = standalone()) {
    if (!appMode || !installed || !subscription || welcomeScheduling || welcomeScheduled) return;
    welcomeScheduling = true;
    try {
      const response = await fetch('/api/push/welcome-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      if (!response.ok) throw new Error('welcome_schedule_failed');
      const result = await response.json();
      welcomeScheduled = result.scheduled || result.alreadyScheduled;
    } catch (error) {
      console.warn('Welcome notification could not be scheduled:', error?.message || error);
    } finally { welcomeScheduling = false }
  }
  const showInstallHelp = () => {
    root.querySelector('#pwa-dialog-title').textContent = 'ثبتي تطبيق الركائز البشرية للاستقدام';
    root.querySelector('[data-pwa-dialog-copy]').textContent = iOS ? 'لتثبيت التطبيق على iPhone أو iPad، اتبعي الخطوات التالية:' : 'من قائمة المتصفح اختاري «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». ';
    root.querySelector('[data-pwa-ios-steps]').hidden = !iOS;
    backdrop.hidden = false;
  };
  const updateInstallButton = () => { installButtons.forEach(button => { button.hidden = standalone() }) };
  updateInstallButton();
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; updateInstallButton() });
  window.addEventListener('appinstalled', async () => {
    installPrompt = null;
    updateInstallButton();
    showToast('تم تثبيت تطبيق الركائز البشرية للاستقدام بنجاح.');
    try { const ready = await navigator.serviceWorker.ready; await scheduleWelcome(await ready.pushManager.getSubscription(), true) } catch {}
  });
  installButtons.forEach(installButton => installButton.addEventListener('click', async () => {
    if (!installPrompt) { showInstallHelp(); return }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') showToast('جاري تثبيت تطبيق الركائز البشرية للاستقدام.');
    installPrompt = null;
    updateInstallButton();
  }));
  root.querySelectorAll('[data-pwa-close],[data-pwa-dismiss]').forEach(button => button.addEventListener('click', () => { backdrop.hidden = true }));
  backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.hidden = true });
  root.querySelector('[data-push-dismiss]').addEventListener('click', () => {
    pushOptin.hidden = true;
    try { localStorage.setItem('rakaez-pwa-push-dismissed', '1') } catch {}
  });

  const preferenceKey = 'rakaez-pwa-push-topics';
  const selectedTopics = () => {
    const boxes = [...document.querySelectorAll('[data-push-topic]')];
    return boxes.length
      ? { workers: Boolean(boxes.find(box => box.dataset.pushTopic === 'workers')?.checked), rental: Boolean(boxes.find(box => box.dataset.pushTopic === 'rental')?.checked) }
      : { workers: true, rental: true };
  };
  function restoreTopicPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
      if (!saved) return;
      document.querySelectorAll('[data-push-topic]').forEach(box => {
        if (Object.hasOwn(saved, box.dataset.pushTopic)) box.checked = saved[box.dataset.pushTopic] === true;
      });
    } catch {}
  }
  function persistTopicPreferences(topics) {
    try { localStorage.setItem(preferenceKey, JSON.stringify(topics)) } catch {}
  }
  restoreTopicPreferences();
  document.querySelectorAll('[data-push-topic]').forEach(box => box.addEventListener('change', () => persistTopicPreferences(selectedTopics())));
  const decodeKey = value => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  };
  async function updatePushButton() {
    if (!pushButtons.length) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) { pushButtons.forEach(button => { button.hidden = true }); return }
    if (Notification.permission === 'denied') {
      pushButtons.forEach(button => { button.disabled = true; if (button.classList.contains('pwa-optin-accept')) button.textContent = 'فعّليها من إعدادات المتصفح'; else if (appMode) button.textContent = 'التنبيهات محظورة من المتصفح'; else if (button.querySelector('span:last-child')) button.querySelector('span:last-child').textContent = 'التنبيهات محظورة' });
      pushOptin.hidden = true;
      return;
    }
    const subscription = registration && await registration.pushManager.getSubscription();
    const label = subscription ? 'حفظ تفضيلاتك' : 'فعّلي التنبيهات';
    pushButtons.forEach(button => {
      if (button.classList.contains('pwa-optin-accept')) return;
      if (appMode) button.innerHTML = `${label} <span aria-hidden="true">←</span>`;
      else { const text = button.querySelector('span:last-child'); if (text) text.textContent = subscription ? 'حفظ تفضيلات التنبيه' : 'تفعيل التنبيهات' }
    });
    if (disableButton) disableButton.hidden = !subscription;
  }
  async function savePreferences(subscription, { notify = true } = {}) {
    const response = await fetch('/api/push/subscribe', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint, topics: selectedTopics() }) });
    if (!response.ok) throw new Error('تعذر حفظ اختيارات التنبيه.');
    if (notify) showToast('تم حفظ تفضيلات التنبيه على هذا الجهاز.');
  }
  async function enableOrSavePush() {
    if (!registration) throw new Error('التطبيق غير جاهز بعد. أعيدي تحميل الصفحة وحاولي مجددًا.');
    const topics = selectedTopics();
    if (!topics.workers && !topics.rental) { showToast('اختاري فئة واحدة على الأقل للتنبيهات.'); return }
    persistTopicPreferences(topics);
    const current = await registration.pushManager.getSubscription();
    if (current) { await savePreferences(current); await updatePushButton(); return }
    if (iOS && !standalone()) { showInstallHelp(); showToast('ثبتي التطبيق أولًا على الشاشة الرئيسية ثم فعّلي التنبيهات.'); return }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') { showToast('لم يتم السماح بإرسال التنبيهات. يمكنك تفعيلها من إعدادات المتصفح.'); await updatePushButton(); return }
    const keyResponse = await fetch('/api/push/key', { cache: 'no-store' });
    if (!keyResponse.ok) throw new Error('إعداد التنبيهات غير مكتمل على الخادم.');
    const { publicKey } = await keyResponse.json();
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
    const response = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription, topics }) });
    if (!response.ok) { await subscription.unsubscribe(); throw new Error('تعذر حفظ اشتراك التنبيهات.'); }
    await scheduleWelcome(subscription);
    pushOptin.hidden = true;
    try { localStorage.setItem('rakaez-pwa-push-dismissed', '1') } catch {}
    showToast('تم تفعيل تنبيهات الركائز البشرية للاستقدام.');
    await updatePushButton();
  }
  pushButtons.forEach(pushButton => pushButton.addEventListener('click', async () => {
    pushButtons.forEach(button => { button.disabled = true });
    try { await enableOrSavePush() } catch (error) { console.error('PWA push setup failed:', error?.message || error); showToast(error.message || 'تعذر تفعيل التنبيهات الآن.') }
    finally { pushButtons.forEach(button => { button.disabled = false }) }
  }));
  disableButton?.addEventListener('click', async () => {
    disableButton.disabled = true;
    try {
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;
      const response = await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      if (!response.ok) throw new Error('تعذر إيقاف التنبيهات.');
      await subscription.unsubscribe();
      try { localStorage.removeItem(preferenceKey) } catch {}
      showToast('تم إيقاف تنبيهات الركائز البشرية للاستقدام على هذا الجهاز.');
      await updatePushButton();
    } catch (error) { showToast(error.message || 'تعذر إيقاف التنبيهات.') }
    finally { disableButton.disabled = false }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(async value => {
        registration = value;
        await updatePushButton();
        if (!appMode || !('Notification' in window) || !('PushManager' in window)) return;
        if (Notification.permission === 'granted') {
          try {
            const current = await registration.pushManager.getSubscription();
            if (current) await savePreferences(current, { notify: false });
            else await enableOrSavePush();
          } catch (error) { console.warn('Automatic push resume failed:', error?.message || error) }
          return;
        }
        if (Notification.permission === 'default' && !localStorage.getItem('rakaez-pwa-push-dismissed')) setTimeout(() => { pushOptin.hidden = false }, 1400);
      })
      .catch(error => { console.error('PWA service worker registration failed:', error); pushButtons.forEach(button => { button.hidden = true }) });
  } else pushButtons.forEach(button => { button.hidden = true });
})();
