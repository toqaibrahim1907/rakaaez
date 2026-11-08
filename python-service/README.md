# خدمة استخراج السير الذاتية

هذه خدمة FastAPI مستقلة تستخدم نسخة المصدر الحالية من `pdf-extraction/smart_cv` دون إعادة كتابة المحرك. أُدرجت نسخة المحرك داخل هذا المجلد كي يستطيع مستضيف الخدمة بناءه من مستودع GitHub؛ يبقى مجلد المصدر الأصلي كما هو.

## تدفق الملف

1. يرفع موظف مخول PDF إلى bucket `worker-cvs` الخاص باستخدام جلسة Supabase الخاصة به.
2. تتحقق دالة Vercel من جلسة الموظف ودوره، ثم تنشئ رابط تنزيل موقّتًا لمدة 10 دقائق من Supabase.
3. ترسل Vercel الرابط إلى هذه الخدمة عبر `CV_EXTRACTION_SECRET`؛ لا يصل الرابط أو السر إلى المتصفح.
4. تنزّل الخدمة PDF إلى مجلد مؤقت، تتحقق من الملف، تشغّل المحرك، ثم تحذف الملفات المؤقتة.
5. تعيد حقول الاستخراج والثقة والتحذيرات ومعاينات صور مصغرة مرشحة. لا تحفظ الخدمة بيانات عاملة أو ملفات PDF.
6. تعرض لوحة الإدارة النتائج؛ لا يُنشأ صف في `workers` إلا بعد ضغط الموظف على «تأكيد وحفظ المسودة».

## التشغيل محليًا

استخدم Python 3.11 وTesseract مع بيانات `ara` و`eng`، ثم:

```powershell
cd python-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:SUPABASE_URL = "https://your-project-ref.supabase.co"
$env:CV_EXTRACTION_SECRET = "same-long-random-secret-as-vercel"
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

تحققي من `http://127.0.0.1:8000/health`. تبيّن استجابة الفحص هل Tesseract وملفات اللغة موجودة.

## نشر الخدمة على Render

أنشئي Web Service من مستودع GitHub نفسه:

- Runtime: Docker.
- Root/Context directory: جذر المستودع.
- Dockerfile path: `python-service/Dockerfile`.
- Health check path: `/health`.
- متغيرات الخدمة: `SUPABASE_URL` و`CV_EXTRACTION_SECRET`.
- استخدمي خطة خدمة تعمل باستمرار لطلبات OCR؛ المعالجة تتم داخل الذاكرة في مهمة خلفية، لذلك لا تستخدمي نسخًا متعددة من الخدمة لهذا الإصدار.

بعد النشر انسخي عنوان `onrender.com` إلى `CV_EXTRACTION_URL` في Vercel. أضيفي إلى مشروع Vercel الخاص بالموقع:

- `SUPABASE_URL`: رابط مشروع Supabase الحالي.
- `SUPABASE_PUBLISHABLE_KEY`: مفتاح المتصفح الحالي `sb_publishable_...`.
- `CV_EXTRACTION_URL`: عنوان Render من دون مسار إضافي.
- `CV_EXTRACTION_SECRET`: القيمة نفسها الموجودة في Render.

لا يحتاج هذا التكامل إلى `service_role` أو Supabase secret key. تتطلب الخدمة سرًا مشتركًا في كل طلب، وتقصر روابط الملفات على روابط HTTPS مؤقتة من bucket `worker-cvs` في مشروع Supabase المضبوط.

## قاعدة البيانات والتخزين

قبل الحفظ، شغّلي `supabase/add-worker-cv-extraction-fields.sql` يدويًا في SQL Editor. يضيف `salary` و`religion` و`passport_number` فقط. يبقى `job` مرتبطًا بعمود `profession`، و`worker_photo` بعمود `photo_path`. لا تضيفي الحقول الحساسة إلى عرض `published_workers`.

تحتاج buckets الحالية إلى أن تبقى خاصة: `worker-cvs` و`worker-photos`. تحدد سياسات Storage وصول الموظفين؛ صلاحية signed URL تُطلب بجلسة الموظف نفسها، ثم يكون الرابط صالحًا 10 دقائق للتحليل.

## حدود هذا الإصدار

- حالة مهام الاستخراج محفوظة مؤقتًا بذاكرة عملية الخدمة؛ أي إعادة تشغيل للخدمة أثناء المهمة تجعلها غير متاحة ويحتاج الموظف لإعادة التحليل. ملف PDF يبقى في Supabase.
- يتوقف الملف الأكبر من 15 MiB، بما يطابق حد bucket الحالي.
- أسماء المرشحات ليست ضمن الحقول السبعة التي يعيدها المحرك؛ يكتبها الموظف بعد مراجعة السيرة.
- قد لا يكتشف Tesseract بعض الخطوط أو المسح الرديء. الثقة المنخفضة والحقول الفارغة تظهر للمراجعة اليدوية.
- اختبار المحرك المحلي المسجل داخل مجلد `pdf-extraction` يختبر 7 ملفات/56 قيمة، لكن لا يُعد ضمانًا لدقة كل تخطيط سيرة.
