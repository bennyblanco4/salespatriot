import { fetchDailyRfqs } from "../lib/dibbs";
async function main() {
  const one = await fetchDailyRfqs();
  const two = await fetchDailyRfqs(one.date, 2);
  let last = await fetchDailyRfqs(one.date, one.pages);
  if (last.page < last.pages) last = await fetchDailyRfqs(one.date, last.pages);
  if (one.rows[0].id === two.rows[0].id)
    throw new Error("Pagination repeated page one");
  if (last.rows.length !== (last.total % 50 || 50))
    throw new Error("Unexpected last page");
  console.log(
    JSON.stringify({
      date: one.date,
      total: last.total,
      pages: last.pages,
      first: one.rows[0],
      secondPage: two.rows[0],
      lastPageRecords: last.rows.length,
    }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
