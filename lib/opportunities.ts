export type Opportunity = {
  purchaseRequest: string;
  status: string;
  id: string;
  solicitation: string;
  nsn: string;
  fsc: string;
  title: string;
  quantity: number | null;
  unit: string;
  setAside: string;
  issued: string | null;
  due: string | null;
  docs: boolean | null;
  url: string;
};
export function daysLeft(
  date: string | null,
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date()),
) {
  return date
    ? Math.round((Date.parse(date) - Date.parse(today)) / 86400000)
    : null;
}
export type Filters = {
  search: string;
  fsc: string;
  setAside: string;
  due: string;
  docs: boolean;
  quantity: string;
  open: boolean;
};
export const initialFilters: Filters = {
  search: "",
  fsc: "",
  setAside: "",
  due: "",
  docs: false,
  quantity: "",
  open: true,
};
export function filterRows(rows: Opportunity[], f: Filters) {
  return rows.filter((r) => {
    const days = daysLeft(r.due);
    const q = f.search.toLowerCase().trim();
    return (
      (!q ||
        `${r.title} ${r.nsn} ${r.solicitation} ${r.nsn.replaceAll("-", "")}`
          .toLowerCase()
          .includes(q)) &&
      (!f.fsc || r.fsc === f.fsc) &&
      (!f.setAside || r.setAside === f.setAside) &&
      (!f.due || (days !== null && days >= 0 && days <= Number(f.due))) &&
      (!f.docs || r.docs === true) &&
      (!f.quantity ||
        (r.quantity !== null && r.quantity >= Number(f.quantity))) &&
      (!f.open || (r.status === "Open" && (days === null || days >= 0)))
    );
  });
}
