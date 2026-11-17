import { crudView } from "./crud.js";
import { workerExtras } from "./workers.js";
export const archiveView = (state, refresh) =>
  crudView(state, "workers", refresh, {
    archived: true,
    extraActions: (row) => workerExtras(state, row, refresh),
    message:
      "الأرشفة تخفي الملف من قائمة العاملات وتحافظ على تاريخ العقود والمستحقات. لا تغيّر حالة العاملة أو العقود.",
  });
