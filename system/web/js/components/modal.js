import { el, button, showError, notify } from "./dom.js";
const modalElement = () => document.querySelector("#record-modal");
export function closeModal() {
  globalThis.bootstrap.Modal.getInstance(modalElement())?.hide();
}
export function modal(title, content, { size = "standard", section = "مساحة العمل", tone = "default", descriptionId } = {}) {
  const dialog = modalElement();
  const heading = document.querySelector("#modal-title");
  const body = document.querySelector("#modal-body");
  const opener = document.activeElement;
  const alreadyOpen = dialog.classList.contains("show");
  heading.textContent = title;
  dialog.dataset.size = size;
  dialog.dataset.tone = tone;
  const kicker = dialog.querySelector(".modal-kicker");
  const icon = dialog.querySelector(".modal-heading-icon");
  if (kicker) kicker.textContent = section;
  if (icon) icon.textContent = { default: "▤", preview: "↗", danger: "!" }[tone];
  if (descriptionId) dialog.setAttribute("aria-describedby", descriptionId);
  else dialog.removeAttribute("aria-describedby");
  body.replaceChildren(content);
  body.scrollTop = 0;
  const instance = globalThis.bootstrap.Modal.getOrCreateInstance(dialog, {
    backdrop: "static",
  });
  const focusContent = () => {
    if (!body.contains(content)) return;
    const preferred = content.querySelector("[data-modal-focus]");
    const field = content.querySelector("input:not([type=hidden], [disabled], [readonly]), select:not([disabled]), textarea:not([disabled], [readonly])");
    const touch = globalThis.matchMedia?.("(pointer: coarse)").matches;
    (preferred || (!touch && field) || heading).focus({ preventScroll: true });
  };
  if (alreadyOpen) {
    instance.handleUpdate?.();
    focusContent();
  } else {
    dialog.addEventListener("shown.bs.modal", focusContent, { once: true });
    dialog.addEventListener("hidden.bs.modal", () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }, { once: true });
    instance.show(opener);
  }
}
export function confirmAction(title, message, action) {
  const errors = el("div");
  const submit = el(
    "button",
    { class: "primary danger-fill", type: "submit" },
    "تأكيد",
  );
  const form = el(
    "form",
    {},
    errors,
    el("p", { id: "modal-confirm-description", class: "modal-confirm-message" }, message),
    el("footer", { class: "modal-footer" }, button("إلغاء", closeModal, "secondary", { "data-modal-focus": "" }), submit),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      await action();
      closeModal();
      notify("تم حفظ التغييرات");
    } catch (error) {
      showError(error, errors);
    } finally {
      submit.disabled = false;
    }
  });
  modal(title, form, { size: "compact", section: "تأكيد الإجراء", tone: "danger", descriptionId: "modal-confirm-description" });
}
