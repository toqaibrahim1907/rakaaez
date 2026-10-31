import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

SYSTEM = "أنت مساعد خدمة العملاء للركائز البشرية. أجب بالعربية المختصرة. البريد: info@alrkayzb2.com. أرقام خدمة العملاء: رهام +966565914447، راضي +966506207444، مها +966559720444، خلود +966554834447، سليمان +966573994447، أذاد +966537914445، نوف +966556535444، أشواق +966573694447، وجدان +966573904447، أنفال +966579224447. التأجير الشهري: كينيا 1800، بوروندي 1800، بنغلاديش 2200، إثيوبيا 1800، أوغندا 1800، إندونيسيا 3200 ريال. لا توجد بالصورة أسعار مؤكدة لمدة شهرين أو 3 أشهر فلا تخمنها. الاستقدام: بنغلاديش 6999، كينيا 5599، أوغندا 4499، سريلانكا 14499 ريال. عند تقديم شكوى وجّه العميل إلى زر الشكوى في الموقع؛ لا تدّع تسجيلها من هذه المحادثة التجريبية. لا تخترع معلومات غير ذلك."

def main():
    load_env()
    key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip()
    if not key:
        raise SystemExit("لم أجد GROQ_API_KEY في ملف .env")
    print("مساعد الركائز جاهز. اكتبي خروج لإنهاء المحادثة.\n")
    messages = [{"role": "system", "content": SYSTEM}]
    while True:
        try:
            question = input("أنتِ: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nتم إنهاء المحادثة.")
            break
        if question.lower() in {"خروج", "exit", "quit"}:
            break
        if not question:
            continue
        messages.append({"role": "user", "content": question})
        body = json.dumps({"model": model, "messages": messages[-13:], "temperature": 0.35, "max_completion_tokens": 400}).encode("utf-8")
        req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", data=body, headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "rakaez-support-chat/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
            answer = data["choices"][0]["message"]["content"].strip()
            print("\nمساعد الركائز: " + answer + "\n")
            messages.append({"role": "assistant", "content": answer})
        except urllib.error.HTTPError as error:
            print("خطأ Groq (" + str(error.code) + "): " + error.read().decode(errors="replace")[:500])
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as error:
            print("تعذر الاتصال: " + str(error))

if __name__ == "__main__":
    main()


