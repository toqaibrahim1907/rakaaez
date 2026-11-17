import { client } from "../../supabase-client.js";
import {
  el,
  button,
  hint,
  showError,
  notify,
  empty,
  dateLabel,
} from "../../components/dom.js";
import { modal, closeModal, confirmAction } from "../../components/modal.js";
import { checked } from "../../data/repository.js";
import { has } from "../../permissions.js";
const bucket = () => client.storage.from("rental-documents");
export async function inspectFile(file) {
  if (!file || file.size === 0 || file.size > 10485760)
    throw new Error("اختر ملفاً حتى 10 ميجابايت");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = file.name.split(".").at(-1).toLowerCase();
  if (
    extension === "pdf" &&
    new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
  )
    return "application/pdf";
  if (
    extension === "doc" &&
    [208, 207, 17, 224, 161, 177, 26, 225].every((b, i) => bytes[i] === b)
  )
    return "application/msword";
  if (
    extension === "docx" &&
    bytes[0] === 80 &&
    bytes[1] === 75 &&
    new TextDecoder().decode(bytes).includes("word/")
  )
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  throw new Error("نوع الملف غير صحيح. يدعم PDF وWord فقط.");
}
export function uploadForm(state, refresh, previous) {
  const workers = state.data.workers || [];
  const worker = el(
    "select",
    { name: "worker", required: true },
    el("option", { value: "" }, "اختر العاملة"),
    workers.map((w) => el("option", { value: w.id }, w.name)),
  );
  worker.value = previous?.worker_id || "";
  if (previous) worker.disabled = true;
  const category = el(
    "select",
    { name: "category" },
    el("option", { value: "cv" }, "سيرة ذاتية"),
    el("option", { value: "residency" }, "مرفق الإقامة"),
  );
  category.value = previous?.category || "cv";
  const file = el("input", {
    type: "file",
    accept: ".pdf,.doc,.docx",
    required: true,
  });
  const errors = el("div");
  const submit = el(
    "button",
    { class: "primary", type: "submit" },
    "رفع المستند",
  );
  const form = el(
    "form",
    {},
    errors,
    el(
      "div",
      { class: "form-grid" },
      el("label", {}, "العاملة", worker),
      el("label", {}, "نوع المستند", category),
      el("label", { class: "wide" }, "PDF أو Word · حتى 10 ميجابايت", file),
    ),
    hint("يُحفظ الملف في مساحة خاصة. رفع إصدار جديد يحافظ على الإصدار السابق."),
    el("footer", { class: "modal-footer" }, button("إلغاء", closeModal), submit),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    const id = crypto.randomUUID();
    const path = `${state.context.organization_id}/${worker.value}/${id}/document`;
    let metadataCreated = false;
    try {
      const source = file.files[0];
      const mime = await inspectFile(source);
      await checked(
        client
          .from("rental_documents")
          .insert({
            id,
            organization_id: state.context.organization_id,
            worker_id: worker.value,
            category: category.value,
            object_path: path,
            original_filename: source.name.slice(0, 200),
            media_type: mime,
            byte_size: source.size,
            previous_document_id: previous?.id || null,
          }),
      );
      metadataCreated = true;
      const result = await bucket().upload(path, source, {
        contentType: mime,
        upsert: false,
      });
      if (result.error) throw result.error;
      closeModal();
      notify("تم رفع المستند");
      await refresh();
    } catch (error) {
      if (metadataCreated) {
        try {
          const removal = await bucket().remove([path]);
          if (!removal.error)
            await checked(
              client.from("rental_documents").delete().eq("id", id),
            );
          else throw removal.error;
        } catch {
          notify(
            "لم يكتمل تنظيف الرفع. أعد تحميل القائمة ثم احذف السجل غير المكتمل.",
            true,
          );
          await refresh();
        }
      }
      showError(error, errors);
    } finally {
      submit.disabled = false;
    }
  });
  modal(previous ? "رفع إصدار جديد" : "رفع مستند", form, { section: "مستندات العاملات" });
}
async function openDocument(doc, preview) {
  const { data, error } = await bucket().download(doc.object_path);
  if (error) throw error;
  const object = URL.createObjectURL(
    new Blob([data], { type: doc.media_type }),
  );
  if (preview && doc.media_type === "application/pdf") {
    const frame = el("iframe", {
      class: "doc-preview",
      src: object,
      sandbox: "",
      title: doc.original_filename,
    });
    modal(doc.original_filename, frame, { section: "معاينة المستند", size: "wide", tone: "preview" });
    document
      .querySelector("#record-modal")
      .addEventListener("hidden.bs.modal", () => URL.revokeObjectURL(object), {
        once: true,
      });
  } else {
    const link = el("a", { href: object, download: doc.original_filename });
    link.click();
    setTimeout(() => URL.revokeObjectURL(object), 10000);
  }
}
export function documentsView(state, refresh) {
  const result = el("div");
  const query = el("input", {
    type: "search",
    placeholder: "ابحث باسم العاملة أو المستند…",
    "aria-label": "بحث المستندات",
  });
  const workerName = (id) =>
    state.data.workers?.find((w) => w.id === id)?.name || "محجوب حسب الصلاحية";
  function render() {
    const rows = (state.data.documents || []).filter((d) =>
      [d.original_filename, workerName(d.worker_id)]
        .join(" ")
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
    );
    const body = el("tbody");
    for (const doc of rows) {
      const actions = [
        button(
          "تنزيل",
          () => openDocument(doc, false).catch(showError),
          "small-button",
        ),
      ];
      if (doc.media_type === "application/pdf")
        actions.unshift(
          button(
            "معاينة",
            () => openDocument(doc, true).catch(showError),
            "small-button",
          ),
        );
      if (has(state.context, "documents", "write")) {
        actions.push(
          button(
            "إصدار جديد",
            () => uploadForm(state, refresh, doc),
            "small-button",
          ),
        );
        actions.push(
          button(
            "حذف",
            () =>
              confirmAction(
                "حذف المستند",
                "سيتم حذف الملف وسجله. لا يُحذف إصدار سابق يرتبط به إصدار أحدث.",
                async () => {
                  if (
                    state.data.documents.some(
                      (d) => d.previous_document_id === doc.id,
                    )
                  )
                    throw new Error(
                      "هناك إصدار أحدث مرتبط بهذا المستند. احذف الإصدار الأحدث أولاً.",
                    );
                  const removal = await bucket().remove([doc.object_path]);
                  if (removal.error) throw removal.error;
                  await checked(
                    client
                      .from("rental_documents")
                      .delete()
                      .eq("organization_id", state.context.organization_id)
                      .eq("id", doc.id),
                  );
                  await refresh();
                },
              ),
            "small-button danger",
          ),
        );
      }
      body.append(
        el(
          "tr",
          {},
          el("td", {}, workerName(doc.worker_id)),
          el("td", {}, doc.original_filename),
          el("td", {}, doc.category === "cv" ? "سيرة ذاتية" : "مرفق الإقامة"),
          el("td", {}, Math.ceil(doc.byte_size / 1024) + " KB"),
          el("td", {}, dateLabel(doc.created_at)),
          el("td", {}, el("div", { class: "row-actions" }, actions)),
        ),
      );
    }
    const header = el(
      "thead",
      {},
      el(
        "tr",
        {},
        [
          "العاملة",
          "المستند",
          "النوع",
          "الحجم",
          "تاريخ الرفع",
          "الإجراءات",
        ].map((label) => el("th", {}, label)),
      ),
    );
    result.replaceChildren(
      el(
        "div",
        { class: "table-scroll" },
        el("table", {}, header, body),
        rows.length ? null : empty(),
      ),
    );
  }
  query.addEventListener("input", render);
  render();
  return el(
    "section",
    { class: "panel" },
    el(
      "div",
      { class: "filters" },
      el("label", { class: "search" }, "⌕", query),
    ),
    result,
  );
}
