import { crudView } from "./crud.js";
export const contractsView = (state, refresh) =>
  crudView(state, "contracts", refresh, {
    message:
      "حالات العقود قابلة للإعداد. التواريخ والحالات تُدار يدوياً؛ المدة المتبقية للعرض فقط.",
  });
