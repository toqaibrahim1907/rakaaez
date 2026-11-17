import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  paymentBalance,
  paymentState,
  groupedMoney,
} from "../web/js/data/model.js";
import { csvCell } from "../web/js/modules/rental/reports.js";
test("money balances use exact decimal arithmetic without salary rules", () => {
  assert.equal(cents("100.10") - cents("30.05"), 7005n);
  assert.equal(cents("0.1") + cents("0.2"), 30n);
  assert.throws(() => cents("1.001"));
  const row = { id: "salary", amount: "100.10" };
  const state = {
    data: {
      payments: [
        { salary_record_id: "salary", amount: "30.05" },
        { salary_record_id: "other", amount: "99.99" },
      ],
    },
  };
  assert.deepEqual(paymentBalance(state, row), {
    paid: 3005n,
    remaining: 7005n,
  });
  assert.equal(paymentState(state, row), "جزئي");
  assert.equal(paymentState({ data: { payments: [] } }, row), "غير مدفوع");
  assert.equal(
    paymentState(
      {
        data: { payments: [{ salary_record_id: "salary", amount: "100.10" }] },
      },
      row,
    ),
    "مدفوع",
  );
  assert.equal(
    paymentState(
      { data: { payments: [{ salary_record_id: "salary", amount: "101" }] } },
      row,
    ),
    "دفعات زائدة",
  );
});
test("totals keep different currencies separate", () => {
  const total = groupedMoney(
    [
      { currency: "SAR", amount: "10.20" },
      { currency: "USD", amount: "20.30" },
    ],
    (row) => cents(row.amount),
  );
  assert.match(total, /ر\.س/);
  assert.match(total, /USD/);
  assert.match(total, / \/ /);
});
test("CSV exports escape formula prefixes and quotes", () => {
  assert.equal(csvCell("=SUM(A1)"), `"'=SUM(A1)"`);
  assert.equal(csvCell("  +cmd"), `"'  +cmd"`);
  assert.equal(csvCell('a"b'), `"a""b"`);
});
