(() => {
  const MAX_PDF_BYTES = 15 * 1024 * 1024;
  const API = '/api/worker-extraction';

  const messages = {
    invalid_pdf: 'الملف لا يبدو PDF صالحًا. اختاري نسخة PDF أصلية.',
    corrupt_pdf: 'تعذر فتح ملف PDF لأنه تالف. احتفظنا بالنسخة المرفوعة ويمكنك إدخال البيانات يدويًا.',
    password_protected: 'ملف PDF محمي بكلمة مرور. احتفظنا بالنسخة المرفوعة؛ أزيلي الحماية أو أدخلي البيانات يدويًا.',
    empty_pdf: 'ملف PDF لا يحتوي على صفحات.',
    file_too_large: 'حجم السيرة أكبر من الحد المسموح به (15 ميجابايت).',
    file_unavailable: 'تعذر على خدمة الاستخراج الوصول إلى نسخة السيرة الخاصة. أعيدي المحاولة أو أدخلي البيانات يدويًا.',
    download_timeout: 'استغرق تنزيل السيرة وقتًا طويلًا. بقي الملف محفوظًا ويمكنك المتابعة يدويًا.',
    extraction_failed: 'تعذر استخراج البيانات الآن. بقي ملف PDF محفوظًا ويمكنك إدخالها يدويًا.',
    extraction_service_busy: 'خدمة استخراج السير مشغولة الآن. بقي الملف محفوظًا؛ أعيدي المحاولة لاحقًا أو أدخلي البيانات يدويًا.',
    extraction_service_unavailable: 'خدمة استخراج السير غير متاحة الآن. بقي الملف محفوظًا ويمكنك إدخال البيانات يدويًا.',
    cv_extraction_not_configured: 'لم تكتمل إعدادات خدمة استخراج السير في Vercel.',
    employee_access_required: 'انتهت صلاحية الدخول أو لا يملك الحساب صلاحية إدارة السير.',
    private_cv_sign_failed: 'تعذر فتح نسخة السيرة الخاصة للتحليل. تحققي من صلاحية الحساب والتخزين.'
  };

  function blankResult() {
    return { fields: { name: null, salary: null, nationality: null, religion: null, age: null, job: null, passport_number: null, experience: null }, raw_fields: {}, confidence: {}, warnings: [], photos: [], selected_photo: null };
  }

  function validPdfHeader(bytes) {
    return new TextDecoder('ascii').decode(bytes.slice(0, 1024)).includes('%PDF-');
  }

  async function accessToken(client) {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.access_token) throw new Error('employee_access_required');
    return data.session.access_token;
  }

  async function uploadPrivatePdf(client, path, file, onProgress) {
    const config = window.RAKAEZ_SUPABASE_CONFIG;
    const token = await accessToken(client);
    if (!config?.url || !config?.anonKey) throw new Error('supabase_upload_failed');
    const objectPath = path.split('/').map(encodeURIComponent).join('/');
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', config.url.replace(/\/$/, '') + '/storage/v1/object/worker-cvs/' + objectPath);
      request.setRequestHeader('apikey', config.anonKey);
      request.setRequestHeader('Authorization', `Bearer ${token}`);
      request.setRequestHeader('Content-Type', 'application/pdf');
      request.setRequestHeader('x-upsert', 'false');
      request.timeout = 60000;
      request.upload.onprogress = event => {
        if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
      };
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('supabase_upload_failed'));
      request.onerror = () => reject(new Error('supabase_upload_failed'));
      request.ontimeout = () => reject(new Error('supabase_upload_failed'));
      request.send(file);
    });
  }

  async function extract(file, { client, userId, onStatus = () => {} }) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('invalid_pdf');
    if (file.size > MAX_PDF_BYTES) throw new Error('file_too_large');
    const prefix = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    if (!validPdfHeader(prefix)) throw new Error('invalid_pdf');

    const stamp = Date.now();
    const ref = `WK-${String(stamp).slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
    const cvId = `CV-${stamp}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    const cvPath = `${userId}/${ref}/${cvId}.pdf`;
    const progress = document.querySelector('#cvUploadProgress');
    const setProgress = (message, percent) => {
      onStatus(message);
      if (!progress) return;
      progress.hidden = false;
      if (percent == null) progress.removeAttribute('value');
      else progress.value = percent;
    };
    setProgress('جارٍ رفع السيرة: 0%', 0);
    try {
      await uploadPrivatePdf(client, cvPath, file, percent => setProgress('جارٍ رفع السيرة إلى التخزين الخاص: ' + percent + '%', percent));
    } catch (cause) {
      if (progress) progress.hidden = true;
      const error = new Error('supabase_upload_failed');
      error.cause = cause;
      throw error;
    }

    const result = { ref, cvId, cvPath, fileName: file.name, cloud: true, extracted: false, fields: blankResult().fields, confidence: {}, warnings: [], photos: [], selectedPhoto: null, extractionError: '' };
    try {
      setProgress('تم حفظ السيرة بأمان. جارٍ تحليل النص والصور…', null);
      let token = await accessToken(client);
      const started = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cv_path: cvPath, file_name: file.name })
      });
      const startData = await started.json().catch(() => ({}));
      if (!started.ok || !startData.job_id) throw new Error(startData.error || 'extraction_service_unavailable');

      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        token = await accessToken(client);
        const response = await fetch(`${API}?job_id=${encodeURIComponent(startData.job_id)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'extraction_service_unavailable');
        if (data.status === 'complete' && data.result) {
          Object.assign(result, {
            fields: data.result.fields || result.fields,
            rawFields: data.result.raw_fields || {},
            confidence: data.result.confidence || {},
            warnings: Array.isArray(data.result.warnings) ? data.result.warnings : [],
            photos: Array.isArray(data.result.photos) ? data.result.photos : [],
            selectedPhoto: data.result.selected_photo || null,
            extracted: true
          });
          if (progress) progress.hidden = true;
          return result;
        }
        if (data.status === 'failed') throw new Error(data.error || 'extraction_failed');
        setProgress('محرك Python يفحص بيانات السيرة والصورة…', null);
      }
      throw new Error('download_timeout');
    } catch (error) {
      result.extractionError = messages[error.message] || messages.extraction_failed;
      onStatus(`${result.extractionError} يمكنك إكمال البيانات يدويًا.`);
      if (progress) progress.hidden = true;
      return result;
    }
  }

  function messageFor(code) {
    return messages[code] || 'تعذر رفع السيرة إلى التخزين الخاص. لم يُنشأ ملف عاملة.';
  }

  window.RakaezCVExtraction = { extract, messageFor, blankResult };
})();
