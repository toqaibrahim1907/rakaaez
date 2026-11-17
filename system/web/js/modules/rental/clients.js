import { crudView, profile } from "./crud.js";
import { button } from "../../components/dom.js";
import { recordForm } from "../../components/forms.js";
import { has } from "../../permissions.js";
export const clientsView = (state, refresh) =>
  crudView(state, "clients", refresh, {
    extraActions: (row) =>
      has(state.context, "clients_private")
        ? [
            button(
              "البيانات الخاصة",
              () => {
                const p = state.data.clients_private?.find(
                  (r) => r.id === row.id,
                );
                if (has(state.context, "clients_private", "write"))
                  recordForm(state, "clients_private", p, refresh, {
                    id: row.id,
                  });
                else
                  profile(
                    state,
                    "clients_private",
                    p || { id: row.id },
                    refresh,
                  );
              },
              "small-button",
            ),
          ]
        : [],
  });
