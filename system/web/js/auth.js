import { client } from "./supabase-client.js";
import { config } from "./config.js";
import { applyIdentity, identityMark, identityName } from "./company-identity.js";
import { el, button, showError, notify } from "./components/dom.js";
export async function session() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}
export async function signOut() {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
export function authScreen(root, { reset = false, onSuccess, identity } = {}) {
  applyIdentity(identity);
  const errors = el("div");
  const email = el("input", {
    type: "email",
    name: "email",
    required: true,
    autocomplete: "username",
    dir: "ltr",
  });
  const password = el("input", {
    type: "password",
    name: "password",
    required: true,
    minlength: 8,
    autocomplete: reset ? "new-password" : "current-password",
    dir: "ltr",
  });
  const submit = el(
    "button",
    { class: "primary", type: "submit" },
    reset ? "حفظ كلمة المرور" : "تسجيل الدخول",
  );
  const form = el(
    "form",
    {},
    errors,
    ...(reset ? [] : [el("label", {}, "البريد الإلكتروني", email)]),
    el("label", {}, reset ? "كلمة المرور الجديدة" : "كلمة المرور", password),
    submit,
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    errors.replaceChildren();
    try {
      const { error } = reset
        ? await client.auth.updateUser({ password: password.value })
        : await client.auth.signInWithPassword({
            email: email.value.trim(),
            password: password.value,
          });
      if (error) throw error;
      if (reset) {
        history.replaceState(null, "", location.pathname);
        notify("تم تغيير كلمة المرور");
      }
      await onSuccess?.();
    } catch (error) {
      showError(error, errors);
    } finally {
      submit.disabled = false;
    }
  });
  root.replaceChildren(
    el(
      "section",
      { class: "auth-screen" },
      el(
        "div",
        { class: "auth-panel" },
        el(
          "div",
          { class: "brand" },
          identityMark(identity),
          el(
            "span",
            {},
            el("b", {}, identityName(identity)),
            el("small", {}, "إدارة التأجير"),
          ),
        ),
        el("h1", {}, reset ? "تعيين كلمة المرور" : "مرحباً بك مجدداً"),
        el("p", {}, "سجّل الدخول إلى مساحة إدارة التأجير الخاصة بشركتك."),
        form,
        ...(reset
          ? []
          : [
              el(
                "div",
                { class: "login-actions" },
                button(
                  "نسيت كلمة المرور؟",
                  async () => {
                    if (!email.reportValidity()) return;
                    try {
                      const { error } = await client.auth.resetPasswordForEmail(
                        email.value.trim(),
                        {
                          redirectTo:
                            (config.appUrl || location.origin).replace(
                              /\/$/,
                              "",
                            ) + "/?reset=1",
                        },
                      );
                      if (error) throw error;
                      notify(
                        "إذا كان البريد مسجلاً، ستصلك رسالة لاستعادة كلمة المرور.",
                      );
                    } catch (error) {
                      showError(error, errors);
                    }
                  },
                  "text-link",
                ),
              ),
            ]),
        el(
          "p",
          { class: "small-note" },
          "الحسابات والصلاحيات تُنشأ بواسطة إدارة الشركة.",
        ),
      ),
    ),
  );
}
