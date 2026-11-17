import { crudView } from "./crud.js";
export const evaluationsView = (state, refresh) =>
  crudView(state, "evaluations", refresh, {
    message:
      "التقييمات والتصنيفات وأيام العمل تُدخل بواسطة المدير. لا توجد درجات أو حدود تصنيف تلقائية.",
  });
