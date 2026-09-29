import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Opportunity } from "../lib/opportunities";

process.env.RFQ_DB_PATH = join(mkdtempSync(join(tmpdir(), "rfq-")), "rfqs.sqlite");

const row: Opportunity = {
  purchaseRequest: "1",
  status: "Open",
  id: "SPE1C1-26-T-1800:8465-01-690-3107:1",
  solicitation: "SPE1C1-26-T-1800",
  nsn: "8465-01-690-3107",
  fsc: "8465",
  title: "BAG, INDIVIDUAL EQUI",
  quantity: 2,
  unit: "",
  setAside: "Unrestricted",
  issued: "2026-09-28",
  due: "2026-10-08",
  docs: false,
  url: "https://www.dibbs.bsm.dla.mil/RFQ/rfqrec.aspx?sn=SPE1C126T1800",
};

test("saves a daily listing and the other issue dates", async () => {
  const { saveDates, loadDates, saveDay, loadDay, savedPastDay } = await import(
    "../lib/store"
  );
  await saveDates(["09-28-2026", "09-27-2026"]);
  assert.deepEqual(await loadDates(), ["09-28-2026", "09-27-2026"]);
  await saveDay({
    date: "09-27-2026",
    rows: [row],
    total: 1,
    pages: 1,
    fetchedAt: "2026-09-28T12:00:00.000Z",
    source: "https://www.dibbs.bsm.dla.mil/RFQ/",
  });
  assert.equal(await loadDay("09-28-2026"), null);
  assert.equal((await loadDay("09-27-2026"))?.rows[0].solicitation, row.solicitation);
  await saveDates(["09-26-2026"]);
  assert.deepEqual(await loadDates(), ["09-26-2026"]);
  assert.equal((await savedPastDay("09-27-2026", "2026-09-28"))?.rows.length, 1);
  assert.equal(await savedPastDay("09-28-2026", "2026-09-28"), null);
  await saveDay({
    date: "09-26-2026",
    rows: [row],
    total: 10,
    pages: 1,
    fetchedAt: "2026-09-28T12:00:00.000Z",
    source: "https://www.dibbs.bsm.dla.mil/RFQ/",
  });
  assert.equal(await savedPastDay("09-26-2026", "2026-09-28"), null);
});
