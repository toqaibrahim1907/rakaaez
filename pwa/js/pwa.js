(() => {
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const appMode = document.body.classList.contains('pwa-app-shell');
  let installPrompt = null;
  let registration = null;
  let toastTimer = 0;

  const root = document.createElement('div');
  const fallbackActions = appMode ? '' : `<div class="pwa-actions" aria-label="تطبيق الركائز"><button type="button" class="pwa-action" data-pwa-install><span aria-hidden="true">⌂</span><span>تثبيت التطبيق</span></button><button type="button" class="pwa-action pwa-action-secondary" data-pwa-push><span aria-hidden="true">🔔</span><span>تفعيل التنبيهات</span></button></div>`;
  root.innerHTML = `${fallbackActions}
    <div class="pwa-toast" role="status" aria-live="polite" hidden></div>
    <div class="pwa-dialog-backdrop" data-pwa-dialog hidden><section class="pwa-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-dialog-title"><span class="pwa-dialog-mark" aria-hidden="true">⌂</span><h2 id="pwa-dialog-title">ثبتي تطبيق الركائز</h2><p data-pwa-dialog-copy>أضيفي التطبيق إلى الشاشة الرئيسية لفتح خدمات الركائز بسرعة.</p><ol data-pwa-ios-steps hidden><li>اضغطي زر المشاركة في المتصفح.</li><li>اختاري «إضافة إلى الشاشة الرئيسية».</li><li>اضغطي «إضافة».</li></ol><div class="pwa-dialog-actions"><button type="button" data-pwa-close>حسنًا</button><button type="button" data-pwa-dismiss>لاحقًا</button></div></section></div>`;
  document.body.append(root);

  const installButton = document.querySelector('[data-pwa-install]');
  const pushButton = document.querySelector('[data-pwa-push]');
  const disableButton = document.querySelector('[data-pwa-disable]');
  const backdrop = root.querySelector('[data-pwa-dialog]');
  const toast = root.querySelector('.pwa-toast');
  const showToast = message => { toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true }, 5200) };
  const showInstallHelp = () => {
    root.querySelector('#pwa-dialog-title').textContent = 'ثبتي تطبيق الركائز';
    root.querySelector('[data-pwa-dialog-copy]').textContent = iOS ? 'لتثبيت التطبيق على iPhone أو iPad، اتبعي الخطوات التالية:' : 'من قائمة المتصفح اختاري «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». ';
    root.querySelector('[data-pwa-ios-steps]').hidden = !iOS;
    backdrop.hidden = false;
  };
  const updateInstallButton = () => { if (installButton) installButton.hidden = standalone() };
  updateInstallButton();
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; updateInstallButton() });
  window.addEventListener('appinstalled', () => { installPrompt = null; updateInstallButton(); showToast('تم تثبيت تطبيق الركائز بنجاح.') });
  installButton?.addEventListener('click', async () => {
    if (!installPrompt) { showInstallHelp(); return }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') showToast('جاري تثبيت تطبيق الركائز.');
    installPrompt = null;
    updateInstallButton();
  });
  root.querySelectorAll('[data-pwa-close],[data-pwa-dismiss]').forEach(button => button.addEventListener('click', () => { backdrop.hidden = true }));
  backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.hidden = true });

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
    if (!pushButton) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) { pushButton.hidden = true; return }
    if (Notification.permission === 'denied') { if (appMode) pushButton.textContent = 'التنبيهات محظورة من المتصفح'; else if (pushButton.querySelector('span:last-child')) pushButton.querySelector('span:last-child').textContent = 'التنبيهات محظورة'; pushButton.disabled = true; return }
    const subscription = registration && await registration.pushManager.getSubscription();
    const label = subscription ? 'حفظ اختيارات التنبيه' : 'تفعيل التنبيهات المحددة';
    if (appMode) pushButton.innerHTML = `${label} <span aria-hidden="true">←</span>`;
    else { const text = pushButton.querySelector('span:last-child'); if (text) text.textContent = subscription ? 'حفظ اختيارات التنبيه' : 'تفعيل التنبيهات' }
    if (disableButton) disableButton.hidden = !subscription;
  }
  async function savePreferences(subscription) {
    const response = await fetch('/api/push/subscribe', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint, topics: selectedTopics() }) });
    if (!response.ok) throw new Error('تعذر حفظ اختيارات التنبيه.');
    showToast('تم حفظ تفضيلات التنبيه على هذا الجهاز.');
  }
  async function enableOrSavePush() {
    if (!registration) throw new Error('التطبيق غير جاهز بعد. أعيدي تحميل الصفحة وحاولي مجددًا.');
    const topics = selectedTopics();
    if (!topics.workers && !topics.rental) { showToast('اختاري فئة واحدة على الأقل للتنبيهات.'); return }
    persistTopicPreferences(topics);
    const current = await registration.pushManager.getSubscription();
    if (current) { await savePreferences(current); await updatePushButton(); return }
    if (iOS && !standalone()) { showInstallHelp(); showToast('ثبتي التطبيق أولًا على الشاشة الرئيسية ثم فعّلي التنبيهات.'); return }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { showToast('لم يتم السماح بإرسال التنبيهات. يمكنك تفعيلها من إعدادات المتصفح.'); await updatePushButton(); return }
    const keyResponse = await fetch('/api/push/key', { cache: 'no-store' });
    if (!keyResponse.ok) throw new Error('إعداد التنبيهات غير مكتمل على الخادم.');
    const { publicKey } = await keyResponse.json();
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
    const response = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription, topics }) });
    if (!response.ok) { await subscription.unsubscribe(); throw new Error('تعذر حفظ اشتراك التنبيهات.'); }
    showToast('تم تفعيل التنبيهات حسب اختياراتك.');
    await updatePushButton();
  }
  pushButton?.addEventListener('click', async () => {
    pushButton.disabled = true;
    try { await enableOrSavePush() } catch (error) { console.error('PWA push setup failed:', error?.message || error); showToast(error.message || 'تعذر تفعيل التنبيهات الآن.') }
    finally { pushButton.disabled = false }
  });
  disableButton?.addEventListener('click', async () => {
    disableButton.disabled = true;
    try {
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;
      const response = await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      if (!response.ok) throw new Error('تعذر إيقاف التنبيهات.');
      await subscription.unsubscribe();
      try { localStorage.removeItem(preferenceKey) } catch {}
      showToast('تم إيقاف تنبيهات الركائز على هذا الجهاز.');
      await updatePushButton();
    } catch (error) { showToast(error.message || 'تعذر إيقاف التنبيهات.') }
    finally { disableButton.disabled = false }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(value => { registration = value; return updatePushButton() })
      .catch(error => { console.error('PWA service worker registration failed:', error); if (pushButton) pushButton.hidden = true });
  } else if (pushButton) pushButton.hidden = true;
})();
