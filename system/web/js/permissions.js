export const permissionLabels = {
  website: "الموقع الإلكتروني",
  recruitment: "الاستقدام",
  housing: "السكن",
  employees: "الموظفون",
  leaves: "الإجازات",
  complaints: "الشكاوى",
  requests: "طلبات العملاء",
  workers: "العاملات",
  workers_private: "بيانات العاملات الخاصة",
  clients: "العملاء",
  clients_private: "بيانات العملاء الخاصة",
  contracts: "العقود",
  salaries: "الرواتب",
  evaluations: "التقييمات",
  documents: "المستندات",
  reports: "التقارير",
  settings: "الإعدادات",
  access: "إدارة الوصول",
  audit: "سجل المراجعة",
  import: "الاستيراد",
};
export function has(context, area, action = "read") {
  return Boolean(context?.permissions?.includes(`rental.${area}.${action}`));
}
export function permissionName(code) {
  const [, area, action] = code.split(".");
  return `${permissionLabels[area] || area} · ${action === "read" ? "عرض" : "إدارة"}`;
}

