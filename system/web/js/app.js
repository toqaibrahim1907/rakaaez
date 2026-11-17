import { configured } from "./config.js";
import { client } from "./supabase-client.js";
import { applyIdentity, identityMark, identityName, identityView, loadIdentity, loadLoginIdentity } from "./company-identity.js";
import { authScreen, session, signOut } from "./auth.js";
import { el, button, showError, dateLabel, today } from "./components/dom.js";
import { recordForm } from "./components/forms.js";
import { models } from "./data/model.js";
import { loadState } from "./data/repository.js";
import { has } from "./permissions.js";
import { dashboardView } from "./modules/rental/dashboard.js";
import { workersView } from "./modules/rental/workers.js";
import { clientsView } from "./modules/rental/clients.js";
import { contractsView } from "./modules/rental/contracts.js";
import { salariesView } from "./modules/rental/salaries.js";
import { evaluationsView } from "./modules/rental/evaluations.js";
import { documentsView, uploadForm } from "./modules/rental/documents.js";
import { archiveView } from "./modules/rental/archive.js";
import { reportsView } from "./modules/rental/reports.js";
import { settingsView } from "./modules/rental/settings.js";
import { accessView } from "./modules/rental/access.js";
import { operationsView, auditView } from "./modules/operations.js";
import { websiteView } from "./modules/website.js";
import { recruitmentPages, recruitmentView } from "./modules/recruitment.js";
const root = document.querySelector("#app");
let state = null,
  user = null,
  loading = false;
const openSidebarGroups = new Set();
let sidebarRoute;
const navigation = [
  ["dashboard", "لوحة التحكم", "◫"],
  ["website", "إدارة الموقع", "▤"],
  ["workers", "العاملات", "♧"],
  ["documents", "السير الذاتية", "▧"],
  ["contracts", "العقود", "▤"],
  ["salaries", "الرواتب", "▣"],
  ["reports", "التقارير", "◴"],
  ["evaluations", "مستوى العاملات", "☆"],
  ["archive", "الأرشيف", "▥"],
  ["clients", "العملاء", "⌂"],
  ...recruitmentPages,
  ["housing", "سجل السكن والحركات", "⌂"],
  ["employees", "الموظفون", "♙"],
  ["leaves", "طلبات الإجازة", "▦"],
  ["complaints", "الشكاوى والبلاغات", "⚠"],
  ["requests", "طلبات العملاء", "▧"],
  ["audit", "سجل النشاط الإداري", "↶"],
];
const descriptions = {
  website: "إدارة محتوى الموقع وطلباته بحساب الموقع الموجود",
  identity: "الاسم والشعار والألوان وبيانات التواصل",
  dashboard: "نظرة شاملة على العاملات والعقود والالتزامات المالية",
  workers: "ملفات العاملات، التوفر، والمعلومات التشغيلية",
  documents: "مكتبة السير الذاتية المرتبطة بملفات العاملات",
  contracts: "متابعة العقود وحالاتها والتواريخ المسجلة",
  salaries: "مستحقات يدوية، دفعات موثقة، وسجل واضح",
  reports: "استكشف بيانات التأجير حسب الفترة والحالة",
  evaluations: "تقييمات المدير وسجل أداء كل عاملة",
  archive: "الملفات المؤرشفة محفوظة ويمكن استعادتها",
  clients: "بيانات العملاء المرتبطة بعقود التأجير",
  settings: "إعدادات العرض وحالات العقود",
  access: "صلاحيات واضحة لكل دور ومستخدم",
  housing: "متابعة الإشغال ودخول العاملات ومغادرتهن",
  employees: "سجلات الموظفين والأقسام",
  leaves: "متابعة الطلبات وقرارات اعتماد الإجازة",
  complaints: "تسجيل البلاغات ومتابعتها حتى الإغلاق",
  requests: "متابعة طلبات خدمات التأجير والاستقدام",
  audit: "العمليات المسجلة مع التوقيت ومنفذ العملية",
};
function page() {
  return location.hash.slice(1) || "dashboard";
}
function navigate(next) {
  if (page() === next) render();
  else location.hash = next;
}
function allowed(key) {
  return (
    key === "dashboard" ||
    (key === "website" && has(state.context, "website")) ||
    (key === "identity" && state.context.manager) ||
    (key === "settings" && has(state.context, "settings", "write")) ||
    (key === "access" && state.context.manager) ||
    has(state.context, key === "archive" ? "workers" :
      recruitmentPages.some(([route]) => route === key) ? "recruitment" : key)
  );
}
async function refresh() {
  if (loading) return;
  loading = true;
  try {
    state = await loadState();
    if (state.context.organization_id) {
      try {
        state.identity = await loadIdentity(state.context.organization_id, state.context.manager);
        if (!state.identity && state.context.manager && page() === "dashboard" && !sessionStorage.getItem("identity-setup-seen")) {
          sessionStorage.setItem("identity-setup-seen", "1");
          history.replaceState(null, "", "#identity");
        }
      } catch (error) {
        console.error("Company identity unavailable", error);
      }
    }
    render();
  } catch (error) {
    showError(error);
    if (!state)
      root.replaceChildren(
        el(
          "section",
          { class: "auth-screen" },
          el(
            "div",
            { class: "auth-panel" },
            el("h2", {}, "تعذر تحميل مساحة العمل"),
            el("p", {}, error.message),
            button("إعادة المحاولة", refresh, "primary"),
            button("تسجيل الخروج", logout),
          ),
        ),
      );
  } finally {
    loading = false;
  }
}
async function logout() {
  try {
    await signOut();
    state = null;
    user = null;
  } catch (error) {
    showError(error);
  }
}
function render() {
  const key = page();
  const recruitmentPage = recruitmentPages.find(([route]) => route === key);
  if (!state?.context.organization_id) {
    root.replaceChildren(
      el(
        "section",
        { class: "auth-screen" },
        el(
          "div",
          { class: "auth-panel" },
          el("h1", {}, "بانتظار تعيين صلاحياتك"),
          el(
            "p",
            {},
            "حسابك مسجّل، لكن لا توجد عضوية فعالة في الشركة. اطلب من المدير إضافة معرّف حسابك:",
          ),
          el("code", { dir: "ltr" }, user?.id || ""),
          button("تحديث", refresh, "primary"),
          button("تسجيل الخروج", logout),
        ),
      ),
    );
    return;
  }
  const identity = state.identity || { name_ar: state.context.organization_name };
  const company = identityName(identity);
  applyIdentity(identity);
  const title =
    navigation.find((n) => n[0] === key)?.[1] ||
    { identity: "هوية الشركة", settings: "إعدادات التأجير", access: "الأدوار والصلاحيات" }[key] ||
    "إدارة التأجير";
  const routeChanged = sidebarRoute !== key;
  sidebarRoute = key;
  const sidebar = el(
    "aside",
    { class: "sidebar" },
    el(
      "a",
      { class: "brand", href: "#dashboard", "aria-label": company + " · الرئيسية" },
      identityMark(identity),
      el("span", {}, el("b", {}, company), el("small", {}, identity.name_en || "إدارة التأجير")),
    ),
    el(
      "div",
      { class: "workspace" },
      el("span", { class: "workspace-dot" }),
      el(
        "div",
        {},
        el("strong", {}, company),
        el("small", {}, "RENTAL MANAGEMENT"),
      ),
    ),
    el("span", { class: "nav-label" }, "القائمة الرئيسية"),
    el(
      "nav",
      { "aria-label": "القائمة الرئيسية" },
      [
        ["نظرة عامة", ["dashboard"]],
        ["الموقع الإلكتروني", ["website"]],
        ["إدارة التأجير", ["workers","documents","contracts","salaries","reports","evaluations","archive","clients"]],
        ["إدارة الاستقدام", recruitmentPages.map(([route]) => route)],
        ["إدارة السكن والنقل", ["housing"]],
        ["الموارد والعمليات", ["employees","leaves","complaints","requests","audit"]],
      ].map(([group, keys]) => {
        const entries = navigation.filter(([id]) => keys.includes(id) && allowed(id));
        if (!entries.length) return null;
        const hasCurrentPage = entries.some(([id]) => id === key);
        if (routeChanged && hasCurrentPage) openSidebarGroups.add(group);
        return el("details", {
          class: hasCurrentPage ? "nav-group has-current" : "nav-group",
          open: openSidebarGroups.has(group),
          onToggle: ({ currentTarget }) => {
            if (!currentTarget.isConnected) return;
            if (currentTarget.open) openSidebarGroups.add(group);
            else openSidebarGroups.delete(group);
          },
        },
          el("summary", { class: "nav-group-toggle" }, group),
          el("div", { class: "nav-group-pages" },
            entries.map(([id, label, symbol]) =>
              button(
                [
                  el("span", { class: "nav-symbol" }, symbol),
                  el("span", {}, label),
                  key === id ? el("span", {}, "‹") : null,
                ],
                () => navigate(id),
                key === id ? "active" : "",
                { "aria-current": key === id ? "page" : null },
              ),
            ),
          ),
        );
      }),
    ),
    el(
      "div",
      { class: "sidebar-bottom" },
      state.context.manager
        ? button("◈ هوية الشركة", () => navigate("identity"), key === "identity" ? "active" : "")
        : null,
      has(state.context, "settings", "write")
        ? button(
            "⚙ الإعدادات",
            () => navigate("settings"),
            key === "settings" ? "active" : "",
          )
        : null,
      state.context.manager
        ? button(
            "♙ الأدوار والصلاحيات",
            () => navigate("access"),
            key === "access" ? "active" : "",
          )
        : null,
      el(
        "div",
        { class: "user-card" },
        el("div", { class: "avatar" }, (user.email || "R")[0].toUpperCase()),
        el(
          "div",
          {},
          el("strong", {}, user.email),
          el("small", {}, state.context.manager ? "مدير النظام" : "موظف"),
        ),
        button("↪", logout, "", { "aria-label": "تسجيل الخروج" }),
      ),
    ),
  );
  const mobileBackdrop = button(
    "",
    () => {
      sidebar.classList.remove("mobile-open");
      mobileBackdrop.hidden = true;
    },
    "mobile-backdrop",
    { "aria-label": "إغلاق القائمة" },
  );
  mobileBackdrop.hidden = true;
  const topbar = el(
    "header",
    { class: "topbar" },
    el(
      "div",
      { class: "breadcrumbs" },
      button(
        "☰",
        () => {
          sidebar.classList.add("mobile-open");
          mobileBackdrop.hidden = false;
        },
        "icon-button menu-toggle",
        { "aria-label": "فتح القائمة" },
      ),
      el("span", {}, company),
      el("span", {}, "‹"),
      el("b", {}, title),
    ),
    el(
      "div",
      { class: "topbar-tools" },
      el("span", { class: "cloud-status" }, el("span"), "Supabase"),
      el("span", { class: "date-chip" }, "▦ " + dateLabel(today())),
      button("↻", refresh, "icon-button", { "aria-label": "تحديث البيانات" }),
    ),
  );
  let add = null;
  if (key === "dashboard" && has(state.context, "workers", "write"))
    add = button(
      "+ إضافة عاملة",
      () => recordForm(state, "workers", null, refresh),
      "primary",
    );
  else if (
    !recruitmentPage && models[key] &&
    (key === "evaluations"
      ? state.context.manager
      : has(state.context, key, "write"))
  )
    add = button(
      "+ إضافة " + models[key].name,
      () => recordForm(state, key, null, refresh),
      "primary",
    );
  else if (key === "documents" && has(state.context, "documents", "write"))
    add = button("+ رفع مستند", () => uploadForm(state, refresh), "primary");
  const content = el(
    "div",
    { class: "content" },
    !recruitmentPage && el(
      "div",
      { class: "page-heading" },
      el(
        "div",
        {},
        el("div", { class: "eyebrow" }, company + " · إدارة التأجير"),
        el("h1", {}, title),
        el("p", {}, descriptions[key] || ""),
      ),
      add,
    ),
  );
  if (!allowed(key))
    content.append(
      el("section", { class: "panel empty" }, "ليس لديك صلاحية لعرض هذا القسم"),
    );
  else {
    const views = {
      website: () => websiteView(state),
      identity: () => identityView(state, refresh, navigate),
      dashboard: () => dashboardView(state, refresh, navigate),
      workers: () => workersView(state, refresh),
      clients: () => clientsView(state, refresh),
      contracts: () => contractsView(state, refresh),
      salaries: () => salariesView(state, refresh),
      evaluations: () => evaluationsView(state, refresh),
      documents: () => documentsView(state, refresh),
      archive: () => archiveView(state, refresh),
      reports: () => reportsView(state),
      settings: () => settingsView(state, refresh),
      access: () => accessView(state, refresh),
      audit: () => auditView(state),
    };
    content.append(
      (recruitmentPage && recruitmentView(state, refresh, user, navigate, recruitmentPage[3])) ||
        views[key]?.() || (models[key]?.table.startsWith("operations_") && operationsView(state, key, refresh)) ||
        el("section", { class: "panel empty" }, "الصفحة غير موجودة"),
    );
  }
  content.append(
    el(
      "footer",
      { class: "page-footer" },
      el("span", {}, company),
      el("span", {}, "مساحة عمل خاصة · Supabase"),
    ),
  );
  root.replaceChildren(
    el(
      "div",
      { class: "app-shell" },
      sidebar,
      mobileBackdrop,
      el("main", {}, topbar, content),
    ),
  );
}
function showLogin() {
  openSidebarGroups.clear();
  sidebarRoute = undefined;
  authScreen(root, { onSuccess: start });
  const panel = root.querySelector(".auth-panel");
  void loadLoginIdentity().then((identity) => {
    if (user || !identity || !panel?.isConnected) return;
    applyIdentity(identity);
    panel.querySelector(".brand-mark")?.replaceWith(identityMark(identity));
    const name = panel.querySelector(".brand b");
    if (name) name.textContent = identityName(identity);
  }).catch((error) => console.error("Login identity unavailable", error));
}
async function start() {
  try {
    const current = await session();
    user = current?.user || null;
    if (!user) {
      state = null;
      showLogin();
      return;
    }
    if (new URL(location.href).searchParams.get("reset") === "1") {
      authScreen(root, { reset: true, onSuccess: start });
      return;
    }
    await refresh();
  } catch (error) {
    showError(error);
  }
}
if (!configured) {
  root.replaceChildren(
    el(
      "section",
      { class: "auth-screen" },
      el(
        "div",
        { class: "auth-panel" },
        el("h1", {}, "إعداد اتصال Supabase"),
        el(
          "p",
          {},
          "لم تُضبط إعدادات الاتصال العامة بعد. يجب بناء التطبيق مع رابط المشروع والمفتاح القابل للنشر.",
        ),
        el(
          "pre",
          { class: "setup-code" },
          "SUPABASE_URL=…\nSUPABASE_PUBLISHABLE_KEY=…\nAPP_URL=…\nnpm run build",
        ),
      ),
    ),
  );
} else {
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      state = null;
      user = null;
      setTimeout(() => { if (!user) showLogin(); }, 0);
    }
    if (event === "PASSWORD_RECOVERY") {
      setTimeout(() => authScreen(root, { reset: true, onSuccess: start }), 0);
    }
  });
  window.addEventListener("hashchange", () => {
    if (state) render();
  });
  void start();
}

