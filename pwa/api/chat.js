const SYSTEM_PROMPT = `أنت مساعد خدمة العملاء الرسمي لشركة الركائز البشرية للاستقدام في السعودية. أجب بالعربية الواضحة والمختصرة، وبلهجة ودودة. استخدم الحقائق التالية فقط ولا تخترع معلومة أو سعرًا:
البريد: info@alrkayzb2.com.
أرقام خدمة العملاء والواتساب: رهام +966565914447، راضي +966506207444، مها +966559720444، خلود +966554834447، سليمان +966573994447، أذاد +966537914445، نوف +966556535444، أشواق +966573694447، وجدان +966573904447، أنفال +966579224447.
أسعار التأجير الشهرية الظاهرة: كينيا 1800 ريال، بوروندي 1800 ريال، بنغلاديش 2200 ريال، إثيوبيا 1800 ريال، أوغندا 1800 ريال، إندونيسيا 3200 ريال. لا توجد بيانات مؤكدة عن إجمالي الشهرين أو الثلاثة.
أسعار الاستقدام الظاهرة: بنغلاديش 6999 ريال، كينيا 5599 ريال، أوغندا 4499 ريال، سريلانكا 14499 ريال.
عند عرض عدة أسعار، اجعل كل جنسية وسعر في سطر مستقل. إذا سأل العميل عن شكوى، وجّهه إلى زر «تقديم شكوى» في واجهة الموقع، حيث يجمع النظام وصف الشكوى ورقم الهاتف ويحفظها للإدارة. لا تدّع تسجيل شكوى بنفسك. إذا لم تعرف الإجابة، قل ذلك ووجّه العميل لخدمة العملاء.`;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'assistant_not_configured' });
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 12) return res.status(400).json({ error: 'invalid_messages' });
  const clean = messages.map(m => ({ role: m?.role, content: String(m?.content || '').trim() }));
  if (clean.some(m => !['user', 'assistant'].includes(m.role) || !m.content || m.content.length > 1200) || !clean.some(m => m.role === 'user')) return res.status(400).json({ error: 'invalid_messages' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'rakaez-support-chat/1.0' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...clean], temperature: 0.35, max_completion_tokens: 400 }),
      signal: controller.signal
    });
    if (!response.ok) {
      console.error('Groq API returned', response.status);
      return res.status(502).json({ error: 'assistant_unavailable' });
    }
    const result = await response.json();
    const reply = result.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'empty_reply' });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat completion failed', error.name === 'AbortError' ? 'timeout' : error.message);
    return res.status(502).json({ error: 'assistant_unavailable' });
  } finally {
    clearTimeout(timer);
  }
};
