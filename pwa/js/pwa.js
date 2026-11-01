(() => {
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installPrompt = null;
  let registration = null;
  let toastTimer = 0;

  const root = document.createElement('div');
  root.innerHTML = `
    <div class="pwa-actions" aria-label="تطبيق الركائز">
      <button type="button" class="pwa-action" data-pwa-install><span aria-hidden="true">⌂</span><span>تثبيت التطبيق</span></button>
      <button type="button" class="pwa-action pwa-action-secondary" data-pwa-push><span aria-hidden="true">🔔</span><span>تفعيل التنبيهات</span></button>
    </div>
    <div class="pwa-toast" role="status" aria-live="polite" hidden></div>
    <div class="pwa-dialog-backdrop" data-pwa-dialog hidden>
      <section class="pwa-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-dialog-title">
        <span class="pwa-dialog-mark" aria-hidden="true">⌂</span>
        <h2 id="pwa-dialog-title">ثبتي تطبيق الركائز</h2>
        <p data-pwa-dialog-copy>أضيفي التطبيق إلى الشاشة الرئيسية لفتح خدمات الركائز بسرعة.</p>
        <ol data-pwa-ios-steps hidden><li>اضغطي زر المشاركة في المتصفح.</li><li>اختاري «إضافة إلى الشاشة الرئيسية».</li><li>اضغطي «إضافة».</li></ol>
        <div class="pwa-dialog-actions"><button type="button" data-pwa-close>حسنًا</button><button type="button" data-pwa-dismiss>لاحقًا</button></div>
      </section>
    </div>`;
  document.body.append(root);

  const installButton = root.querySelector('[data-pwa-install]');
  const pushButton = root.querySelector('[data-pwa-push]');
  const backdrop = root.querySelector('[data-pwa-dialog]');
  const toast = root.querySelector('.pwa-toast');

  const showToast = message => {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true }, 5200);
  };

  const showInstallHelp = () => {
    root.querySelector('#pwa-dialog-title').textContent = 'ثبتي تطبيق الركائز';
    root.querySelector('[data-pwa-dialog-copy]').textContent = iOS
      ? 'لتثبيت التطبيق على iPhone أو iPad، اتبعي الخطوات التالية:'
      : 'من قائمة المتصفح اختاري «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». ';
    root.querySelector('[data-pwa-ios-steps]').hidden = !iOS;
    backdrop.hidden = false;
  };

  const updateInstallButton = () => { installButton.hidden = standalone() };
  updateInstallButton();
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; updateInstallButton() });
  window.addEventListener('appinstalled', () => { installPrompt = null; updateInstallButton(); showToast('تم تثبيت تطبيق الركائز بنجاح.') });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) { showInstallHelp(); return }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') showToast('جاري تثبيت تطبيق الركائز.');
    installPrompt = null;
    updateInstallButton();
  });

  root.querySelectorAll('[data-pwa-close],[data-pwa-dismiss]').forEach(button => button.addEventListener('click', () => { backdrop.hidden = true }));
  backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.hidden = true });

  const updatePushButton = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      pushButton.hidden = true;
      return;
    }
    if (Notification.permission === 'denied') {
      pushButton.querySelector('span:last-child').textContent = 'التنبيهات محظورة من المتصفح';
      pushButton.disabled = true;
      return;
    }
    const current = registration && await registration.pushManager.getSubscription();
    pushButton.querySelector('span:last-child').textContent = current ? 'إلغاء التنبيهات' : 'تفعيل التنبيهات';
  };

  const decodeKey = value => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  };

  const togglePush = async () => {
    if (!registration) { showToast('الاتصال غير جاهز الآن. أعيدي تحميل الصفحة وحاولي مجددًا.'); return }
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      const response = await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: existing.endpoint }) });
      await existing.unsubscribe();
      if (!response.ok) throw new Error('تعذر إلغاء التنبيهات.');
      showToast('تم إيقاف تنبيهات الركائز على هذا الجهاز.');
      await updatePushButton();
      return;
    }
    if (iOS && !standalone()) { showInstallHelp(); showToast('ثبتي التطبيق أولًا على الشاشة الرئيسية، ثم فعّلي التنبيهات.'); return }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { showToast('لم يتم السماح بإرسال التنبيهات. يمكنك تفعيلها من إعدادات المتصفح.'); await updatePushButton(); return }
    const keyResponse = await fetch('/api/push/key', { cache: 'no-store' });
    if (!keyResponse.ok) throw new Error('إعداد التنبيهات غير مكتمل على الخادم.');
    const { publicKey } = await keyResponse.json();
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
    const saveResponse = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription }) });
    if (!saveResponse.ok) { await subscription.unsubscribe(); throw new Error('تعذر حفظ اشتراك التنبيهات.'); }
    showToast('تم تفعيل تنبيهات الركائز على هذا الجهاز.');
    await updatePushButton();
  };

  pushButton.addEventListener('click', async () => {
    pushButton.disabled = true;
    try { await togglePush() } catch (error) { console.error('PWA push setup failed', error); showToast(error.message || 'تعذر تفعيل التنبيهات الآن.') }
    finally { pushButton.disabled = false }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(value => { registration = value; return updatePushButton() })
      .catch(error => { console.error('PWA service worker registration failed', error); pushButton.hidden = true });
  } else pushButton.hidden = true;
})();
