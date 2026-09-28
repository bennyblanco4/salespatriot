import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRfqHtml, safeLink, formFields } from "../lib/dibbs";
import { filterRows, initialFilters, daysLeft } from "../lib/opportunities";
const html = readFileSync(
  new URL("./dibbs-real-page.html", import.meta.url),
  "utf8",
);
const rows = parseRfqHtml(html);
test("extracts the 50 real DIBBS records and their actual fields", () => {
  assert.equal(rows.length, 50);
  assert.equal(rows[0].solicitation, "SPE1C1-26-T-1800");
  assert.equal(rows[0].nsn, "8465-01-690-3107");
  assert.equal(rows[0].quantity, 2);
  assert.equal(rows[0].due, "2026-10-08");
  assert.equal(rows[0].title, "BAG, INDIVIDUAL EQUI");
  assert.equal(rows[0].setAside, "Unrestricted");
  assert.equal(rows[0].status, "Open");
  assert.equal(rows[0].docs, false);
  assert.match(rows[0].url, /rfqrec.aspx\?sn=SPE1C126T1800/);
});
test("notice and error pages cannot become fabricated records", () => {
  assert.deepEqual(parseRfqHtml("<html>Notice</html>"), []);
});
test("source links are restricted to the original trusted source", () => {
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("https://evil.test/"), null);
});
test("form state is preserved for postback pagination", () => {
  const form = formFields(html);
  assert.ok(form.get("__VIEWSTATE"));
  assert.ok(form.get("__EVENTVALIDATION"));
});
test("search supports formatted and compact NSNs", () => {
  assert.equal(
    filterRows(rows, {
      ...initialFilters,
      open: false,
      search: "8465016903107",
    }).length,
    1,
  );
  assert.equal(
    filterRows(rows, {
      ...initialFilters,
      open: false,
      search: "SPE1C1-26-T-1800",
    }).length,
    1,
  );
});
test("filters combine and exclude closed source status", () => {
  const row = { ...rows[0], due: "2099-10-08" };
  assert.equal(
    filterRows([row], { ...initialFilters, fsc: "8465", quantity: "3" }).length,
    0,
  );
  assert.equal(
    filterRows([{ ...row, status: "Closed" }], initialFilters).length,
    0,
  );
  assert.equal(filterRows([row], { ...initialFilters, docs: true }).length, 0);
});
test("deadline math uses calendar dates", () => {
  assert.equal(daysLeft("2026-10-01", "2026-09-28"), 3);
  assert.equal(daysLeft(null), null);
});
