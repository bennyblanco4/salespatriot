"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  Clock3,
  PackageOpen,
  Radio,
} from "lucide-react";
import {
  daysLeft,
  filterRows,
  initialFilters,
  type Filters,
  type Opportunity,
} from "../lib/opportunities";
type Listing = {
  date: string;
  total: number;
  fetchedAt: string | null;
  stored: boolean;
};
const formatDate = (value: string | null) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "Not provided";
export default function Home() {
  const [rows, setRows] = useState<Opportunity[]>([]),
    [listing, setListing] = useState<Listing | null>(null),
    [dates, setDates] = useState<string[]>([]),
    [syncing, setSyncing] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [filters, setFilters] = useState<Filters>(initialFilters),
    [view, setView] = useState("all"),
    [saved, setSaved] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [sort, setSort] = useState("due"),
    [selected, setSelected] = useState<Opportunity | null>(null);
  const run = useRef(0);
  const search = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("patriotbid-saved") || "[]"));
    } catch {}
    void open();
    return () => {
      run.current++;
    };
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  function applyListing(data: {
    date?: string;
    rows?: Opportunity[];
    total?: number;
    fetchedAt?: string | null;
    stored?: boolean;
    dates?: string[];
  }) {
    if (data.dates?.length) setDates(data.dates);
    setListing({
      date: data.date || "",
      total: data.total || 0,
      fetchedAt: data.fetchedAt || null,
      stored: !!data.stored,
    });
    setRows(data.rows || []);
    setPage(1);
  }
  async function open(date?: string) {
    const id = ++run.current;
    setError("");
    const response = await fetch(
      `/api/opportunities${date ? `?date=${encodeURIComponent(date)}` : ""}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (id !== run.current) return;
    if (!response.ok) {
      setError(data.message || "Could not open the saved listing.");
      setReady(true);
      return;
    }
    if (data.date) applyListing(data);
    setReady(true);
    if (data.date && !data.stored) void pull(data.date, id, false);
    try {
      const listed = await fetch("/api/dates", { cache: "no-store" });
      const body = await listed.json();
      if (id !== run.current) return;
      if (!listed.ok && !body.dates?.length)
        throw new Error(body.message || "Could not load issue dates.");
      if (body.dates?.length) setDates(body.dates);
      if (!data.date && body.dates?.[0]) {
        const next = await fetch(
          `/api/opportunities?date=${encodeURIComponent(body.dates[0])}`,
          { cache: "no-store" },
        );
        const day = await next.json();
        if (id !== run.current) return;
        if (!next.ok)
          throw new Error(day.message || "Could not open the saved listing.");
        applyListing({ ...day, date: body.dates[0] });
        if (!day.stored) void pull(body.dates[0], id, false);
      }
    } catch (e) {
      if (id === run.current && !data.date)
        setError(
          e instanceof Error ? e.message : "Could not load issue dates.",
        );
    }
  }
  async function choose(date: string) {
    if (date === listing?.date) return;
    const id = ++run.current;
    setError("");
    setSyncing(false);
    const response = await fetch(
      `/api/opportunities?date=${encodeURIComponent(date)}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (id !== run.current) return;
    if (!response.ok) {
      setError(data.message || "Could not open this date.");
      return;
    }
    applyListing({ ...data, date });
    if (!data.stored) void pull(date, id, false);
  }
  async function pull(date: string, id: number, keepCurrent: boolean) {
    setSyncing(true);
    setError("");
    let all: Opportunity[] = [];
    let total = 0;
    let pages = 1;
    let fetchedAt = new Date().toISOString();
    let source = "";
    let issueDates: string[] = [];
    try {
      for (let sourcePage = 1; sourcePage <= 200; sourcePage++) {
        const response = await fetch(
          `/api/opportunities?page=${sourcePage}&date=${encodeURIComponent(date)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (id !== run.current) return;
        if (!response.ok)
          throw new Error(data.message || "Could not load DIBBS.");
        issueDates = data.dates?.length ? data.dates : issueDates;
        if (issueDates.length) setDates(issueDates);
        total = data.total;
        pages = data.pages;
        fetchedAt = data.fetchedAt;
        source = data.source;
        all = [
          ...new Map([...all, ...data.rows].map((r) => [r.id, r])).values(),
        ];
        if (!keepCurrent) {
          setRows(all);
          if (sourcePage === 1) setPage(1);
        }
        if (sourcePage >= data.pages) break;
      }
      const save = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          rows: all,
          total,
          pages,
          fetchedAt,
          source,
          dates: issueDates,
        }),
      });
      const saved = await save.json();
      if (id !== run.current) return;
      if (!save.ok) throw new Error(saved.message || "Could not save this date.");
      setRows(all);
      setListing({ date, total, fetchedAt, stored: true });
      if (keepCurrent) setPage(1);
    } catch (e) {
      if (id === run.current)
        setError(e instanceof Error ? e.message : "Could not load DIBBS.");
    } finally {
      if (id === run.current) setSyncing(false);
    }
  }
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }
  function toggleSaved(id: string) {
    const next = saved.includes(id)
      ? saved.filter((s) => s !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("patriotbid-saved", JSON.stringify(next));
    } catch {}
  }
  const filtered = useMemo(
    () =>
      filterRows(rows, filters)
        .filter((r) => view !== "saved" || saved.includes(r.id))
        .sort((a, b) =>
          sort === "due"
            ? (a.due || "9999").localeCompare(b.due || "9999")
            : sort === "quantity"
              ? (b.quantity ?? -1) - (a.quantity ?? -1)
              : a.title.localeCompare(b.title),
        ),
    [rows, filters, view, saved, sort],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const dueSoon = rows.filter((r) => {
    const d = daysLeft(r.due);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const active = Object.entries(filters).filter(
    ([key, value]) => key !== "open" && !!value,
  ).length;
  const dateOptions =
    listing?.date && !dates.includes(listing.date)
      ? [listing.date, ...dates]
      : dates;
  function exportCsv() {
    const keys = [
      "title",
      "nsn",
      "fsc",
      "solicitation",
      "purchaseRequest",
      "quantity",
      "setAside",
      "issued",
      "due",
      "status",
      "url",
    ] as const;
    const csv = [
      keys.join(","),
      ...filtered.map((r) =>
        keys
          .map(
            (k) =>
              '"' +
              String(r[k] ?? "")
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `dibbs-${listing?.date || "rfqs"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function show(r: Opportunity) {
    setSelected(r);
    dialog.current?.showModal();
  }
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <ShieldCheck size={23} />
          </span>
          <span>
            Patriot<span className="brand-light">Bid</span>
            <small>DEFENSE PROCUREMENT</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={view === "all" ? "active" : ""}
            onClick={() => {
              setView("all");
              setPage(1);
            }}
          >
            Opportunities
          </button>
          <button
            className={view === "saved" ? "active" : ""}
            onClick={() => {
              setView("saved");
              setPage(1);
            }}
          >
            Watchlist <span className="count">{saved.length}</span>
          </button>
        </nav>
        <a
          className="source-link"
          href="https://www.dibbs.bsm.dla.mil/RFQ/"
          target="_blank"
          rel="noreferrer"
        >
          Open DIBBS <ArrowUpRight size={15} />
        </a>
        <div className="avatar" title="Local supplier workspace">
          SP
        </div>
      </header>
      <main>
        <div className="breadcrumb">
          Workspace <span>/</span> Solicitation browser
        </div>
        <section className="heading">
          <div>
            <div className="eyebrow">
              <span className="dot" /> DLA OPPORTUNITIES
            </div>
            <h1>
              {view === "saved"
                ? "Your watchlist"
                : "Find your next opportunity."}
            </h1>
            <p>
              {view === "saved"
                ? "Your saved RFQs from the selected daily listing."
                : "A clearer view of DIBBS. Find the parts you supply and the RFQs worth quoting."}
            </p>
          </div>
          <div className="heading-actions">
            <button
              className="button"
              onClick={exportCsv}
              disabled={!filtered.length}
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              className="button primary"
              disabled={syncing || !listing?.date}
              onClick={() => {
                if (!listing?.date) return;
                void pull(listing.date, ++run.current, true);
              }}
            >
              <RefreshCw size={16} className={syncing ? "spin" : ""} />
              {syncing ? "Updating…" : "Update"}
            </button>
          </div>
        </section>
        <section className="stats" aria-label="Listing overview">
          <div>
            <span className="stat-label">
              RFQs in this listing <Layers3 size={18} />
            </span>
            <strong>
              {(listing?.stored ? listing.total : rows.length).toLocaleString()}
            </strong>
            <small>
              {listing?.date
                ? `Issued ${listing.date.replaceAll("-", " / ")}`
                : ready
                  ? "Select an issue date"
                  : "Loading issue dates"}
            </small>
          </div>
          <div>
            <span className="stat-label">
              Opportunities <PackageOpen size={18} />
            </span>
            <strong>{rows.length.toLocaleString()}</strong>
            <small>Saved for this issue date</small>
          </div>
          <div>
            <span className="stat-label">
              Due within 7 days <Clock3 size={18} />
            </span>
            <strong>
              {dueSoon.toLocaleString()}
              <span className="stat-tag">Time sensitive</span>
            </strong>
            <small>In this listing</small>
          </div>
          <div>
            <span className="stat-label">
              Saved for review <Bookmark size={18} />
            </span>
            <strong>{rows.filter((r) => saved.includes(r.id)).length}</strong>
            <small>Watchlist for this issue date</small>
          </div>
        </section>
        <section className="workspace">
          <aside className="filters">
            <div className="filter-title">
              <h2>
                <Filter size={16} /> Refine results
              </h2>
              <button
                className="text-button"
                onClick={() => {
                  setFilters(initialFilters);
                  setPage(1);
                }}
              >
                Reset
              </button>
            </div>
            <label>
              Issue date
              <select
                aria-label="Issue date"
                value={listing?.date || ""}
                disabled={!dateOptions.length}
                onChange={(e) => void choose(e.target.value)}
              >
                {!dateOptions.length && <option value="">Loading dates…</option>}
                {dateOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <div className="divider" />
            <label>
              Federal supply class
              <select
                value={filters.fsc}
                onChange={(e) => update("fsc", e.target.value)}
              >
                <option value="">All categories</option>
                {[...new Set(rows.map((r) => r.fsc))].sort().map((f) => (
                  <option key={f} value={f}>
                    FSC {f}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Set-aside
              <select
                value={filters.setAside}
                onChange={(e) => update("setAside", e.target.value)}
              >
                <option value="">All set-asides</option>
                {[...new Set(rows.map((r) => r.setAside))].sort().map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Quote deadline
              <select
                value={filters.due}
                onChange={(e) => update("due", e.target.value)}
              >
                <option value="">Any deadline</option>
                <option value="3">Within 3 days</option>
                <option value="7">Within 7 days</option>
                <option value="14">Within 14 days</option>
                <option value="30">Within 30 days</option>
              </select>
            </label>
            <label>
              Minimum quantity
              <input
                type="number"
                min="0"
                placeholder="Any quantity"
                value={filters.quantity}
                onChange={(e) => update("quantity", e.target.value)}
              />
            </label>
            <div className="divider" />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={filters.open}
                onChange={(e) => update("open", e.target.checked)}
              />{" "}
              Open RFQs only
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={filters.docs}
                onChange={(e) => update("docs", e.target.checked)}
              />{" "}
              Technical documents available
            </label>
            <div className="filter-note">
              <ShieldCheck size={19} />
              <p>
                Go from discovery to diligence.
                <span>
                  Review requirements and eligibility in the original DIBBS
                  package before quoting.
                </span>
              </p>
            </div>
          </aside>
          <div className="results">
            <div className="search-row">
              <div className="search">
                <Search size={18} />
                <input
                  ref={search}
                  aria-label="Search opportunities"
                  placeholder="Search item, NSN, or solicitation number…"
                  value={filters.search}
                  onChange={(e) => update("search", e.target.value)}
                />
                {filters.search ? (
                  <button
                    aria-label="Clear search"
                    onClick={() => update("search", "")}
                  >
                    <X size={15} />
                  </button>
                ) : (
                  <kbd>⌘ K</kbd>
                )}
              </div>
              <label className="sort">
                <ArrowDownUp size={15} />
                <select
                  aria-label="Sort opportunities"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="due">Due soonest</option>
                  <option value="name">Item name</option>
                  <option value="quantity">Largest quantity</option>
                </select>
              </label>
            </div>
            <div className="results-heading">
              <div>
                <h2>
                  {view === "saved"
                    ? "Saved opportunities"
                    : "All opportunities"}{" "}
                  <span>{filtered.length.toLocaleString()}</span>
                </h2>
                <p>
                  {active
                    ? `${active} active filter${active === 1 ? "" : "s"}`
                    : listing?.date
                      ? `Issue date ${listing.date.replaceAll("-", " / ")}`
                      : "Choose an issue date"}
                </p>
              </div>
              <span className="open-tag">
                <span className="dot" />
                {syncing ? "Updating" : listing?.stored ? "Saved" : "DIBBS"}
              </span>
            </div>
            {error && (
              <div className="error" role="alert">
                <strong>Could not load this date</strong>
                <span>{error}</span>
                <button
                  disabled={syncing || !listing?.date}
                  onClick={() => {
                    if (!listing?.date) return;
                    void pull(listing.date, ++run.current, rows.length > 0);
                  }}
                >
                  Try again
                </button>
              </div>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="bookmark-cell">
                      <Bookmark size={14} />
                      <span className="sr-only">Save</span>
                    </th>
                    <th>ITEM / NSN</th>
                    <th>QUANTITY</th>
                    <th>SET-ASIDE</th>
                    <th>TECH DOCS</th>
                    <th>RETURN BY</th>
                    <th>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const days = daysLeft(r.due);
                    return (
                      <tr key={r.id}>
                        <td>
                          <button
                            className={`save ${saved.includes(r.id) ? "saved" : ""}`}
                            aria-label={`${saved.includes(r.id) ? "Unsave" : "Save"} ${r.title}`}
                            aria-pressed={saved.includes(r.id)}
                            onClick={() => toggleSaved(r.id)}
                          >
                            <Bookmark
                              size={17}
                              fill={
                                saved.includes(r.id) ? "currentColor" : "none"
                              }
                            />
                          </button>
                        </td>
                        <td className="item">
                          <button onClick={() => show(r)}>{r.title}</button>
                          <span className="mono">
                            {r.nsn} <em>FSC {r.fsc}</em>
                          </span>
                          <small>
                            {r.solicitation} · PR {r.purchaseRequest}
                          </small>
                        </td>
                        <td>
                          <strong>{r.quantity?.toLocaleString() ?? "—"}</strong>
                          <small>{r.unit || "See package for unit"}</small>
                        </td>
                        <td>
                          <span
                            className={`badge ${r.setAside === "Unrestricted" ? "neutral" : "blue"}`}
                          >
                            {r.setAside}
                          </span>
                        </td>
                        <td>
                          {r.docs ? (
                            <span className="docs">
                              <FileText size={14} /> Available
                            </span>
                          ) : (
                            <span className="muted">
                              {r.docs === false ? "None listed" : "Unknown"}
                            </span>
                          )}
                        </td>
                        <td className="due">
                          <strong>{formatDate(r.due)}</strong>
                          <small
                            className={
                              days !== null && days <= 3 ? "urgent" : ""
                            }
                          >
                            {days === null
                              ? "Check source"
                              : days < 0
                                ? "Closed"
                                : days === 0
                                  ? "Due today"
                                  : `${days} days left`}
                          </small>
                        </td>
                        <td>
                          <a
                            className="external"
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${r.solicitation} on DIBBS`}
                          >
                            <ArrowUpRight size={18} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <div className="empty">
                <Search size={30} />
                <h3>
                  {!ready || (syncing && !rows.length)
                    ? "Loading this issue date"
                    : error && !rows.length
                      ? "This date could not be loaded"
                      : "No matching opportunities"}
                </h3>
                <p>
                  {!ready || (syncing && !rows.length)
                    ? "The list will show here as soon as this date is ready."
                    : "Try a different search, reset the filters, or select another issue date."}
                </p>
                {ready && !syncing && (
                  <button
                    className="button"
                    onClick={() => {
                      setFilters(initialFilters);
                      setView("all");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            <div className="pagination">
              <span>
                {filtered.length
                  ? `${(currentPage - 1) * 25 + 1}–${Math.min(currentPage * 25, filtered.length)} of ${filtered.length.toLocaleString()} opportunities`
                  : "0 opportunities"}
              </span>
              <div>
                <button
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  aria-label="Next page"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>
        <footer>
          <span>
            <Radio size={13} /> Public data from DLA DIBBS{" "}
            {listing?.fetchedAt &&
              `· Saved ${new Date(listing.fetchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
          </span>
          <span>Built for suppliers. Focused on opportunity.</span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        {selected && (
          <>
            <button
              className="dialog-close"
              aria-label="Close details"
              onClick={() => dialog.current?.close()}
            >
              <X size={20} />
            </button>
            <div className="eyebrow">SOLICITATION DETAILS</div>
            <h2>{selected.title}</h2>
            <p className="mono">{selected.nsn}</p>
            <dl>
              {[
                ["Solicitation", selected.solicitation],
                ["Purchase request", selected.purchaseRequest],
                ["Supply class", selected.fsc],
                [
                  "Quantity",
                  selected.quantity?.toLocaleString() ?? "Not provided",
                ],
                ["Set-aside", selected.setAside],
                ["Issued", formatDate(selected.issued)],
                ["Return by", formatDate(selected.due)],
                ["Status", selected.status],
                [
                  "Technical documents",
                  selected.docs
                    ? "Available"
                    : selected.docs === false
                      ? "None listed"
                      : "Unknown",
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="detail-note">
              Confirm the unit of issue, delivery schedule, specifications, and
              eligibility in the original solicitation.
            </p>
            <a
              className="button primary"
              href={selected.url}
              target="_blank"
              rel="noreferrer"
            >
              View original DIBBS package <ArrowUpRight size={16} />
            </a>
          </>
        )}
      </dialog>
    </>
  );
}
