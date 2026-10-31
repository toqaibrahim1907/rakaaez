-- Fix CMS publish flow for Al Rakaez Al Bashariya
-- Run in Supabase SQL editor after the main schema.sql

-- 1. Ensure the site_content row exists with correct structure
INSERT INTO public.site_content(id) VALUES (1) ON CONFLICT DO NOTHING;

-- 2. Update the default sections structure so it has proper content embedded
-- (This runs once; subsequent saves from admin.js will keep this up to date)
UPDATE public.site_content
SET sections = '[
  {"key":"hero","visible":true,"content":{"eyebrow":"راحة بيتك تبدأ من الاختيار","title":"وقت أكثر لأسرتك، وراحة تدوم.","description":"حلول منزلية مرنة تجمع بين التأجير والاستقدام، لتختار ما يناسب احتياج أسرتك بكل وضوح."}},
  {"key":"about","visible":true,"content":{"eyebrow":"من نحن","title":"نؤمن أن راحة الأسرة تبدأ بحسن الاختيار.","description":"الركائز البشرية للاستقدام تعمل على تقديم حلول منزلية باهتمام ومهنية. نحرص على وضوح الخطوات ومساندة عملائنا في اختيار الخدمة المناسبة لاحتياجاتهم."}},
  {"key":"services","visible":true,"content":{"eyebrow":"خدماتنا","title":"خياران، واحتياجك هو الأساس","description":"اختر بين خدمة التأجير المرنة أو الاستقدام بما يلائم خطط أسرتك.","rentalTitle":"تأجير العمالة المنزلية","rentalDescription":"حل مرن لمن يبحث عن خدمة منزلية لفترة محددة، مع تفاصيل واضحة قبل تقديم الطلب.","recruitmentTitle":"استقدام العمالة المنزلية","recruitmentDescription":"ابدأ طلب الاستقدام وتواصل مع الفريق لمعرفة الخيارات المناسبة لك."}},
  {"key":"workers","visible":true,"content":{"eyebrow":"الخيارات المتاحة","title":"تصفّح البطاقات بسهولة","description":"تُعرض الملفات المنشورة برقم مرجعي، دون بيانات شخصية حساسة."}},
  {"key":"testimonials","visible":true,"content":{"eyebrow":"آراء العملاء","title":"تجارب العملاء على Google Maps","description":"نشارككم تقييمات وآراء العملاء المنشورة على صفحة الشركة الرسمية."}},
  {"key":"cta","visible":true,"content":{"eyebrow":"خطوتك القادمة","title":"أخبرنا بما تحتاجه، ونساعدك في الوصول للخيار الأنسب.","description":"أرسل طلبك المبدئي دون تسجيل حساب.","buttonLabel":"قدّم طلبك الآن"}}
]'::jsonb
WHERE id = 1 AND (sections = '[]'::jsonb OR sections IS NULL);

-- 3. Drop and recreate the RLS policies to ensure correct access
-- Anonymous: can only see the row when published=true (unchanged)
DROP POLICY IF EXISTS "public reads published content" ON public.site_content;
CREATE POLICY "public reads published content" ON public.site_content
  FOR SELECT TO anon USING (published = true);

-- Authenticated general users: same as anon (only published)
DROP POLICY IF EXISTS "authenticated reads published content" ON public.site_content;
CREATE POLICY "authenticated reads published content" ON public.site_content
  FOR SELECT TO authenticated USING (published = true);

-- Content managers: can always read the full row (including draft/unpublished)
DROP POLICY IF EXISTS "content managers read content" ON public.site_content;
CREATE POLICY "content managers read content" ON public.site_content
  FOR SELECT TO authenticated
  USING (public.employee_role() IN ('super_admin', 'content_manager'));

-- Content managers: can write (unchanged)
DROP POLICY IF EXISTS "content managers write content" ON public.site_content;
CREATE POLICY "content managers write content" ON public.site_content
  FOR ALL TO authenticated
  USING (public.employee_role() IN ('super_admin', 'content_manager'))
  WITH CHECK (public.employee_role() IN ('super_admin', 'content_manager'));

-- 4. Add a trigger to auto-update the updated_at column on each update
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS site_content_updated_at ON public.site_content;
CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
