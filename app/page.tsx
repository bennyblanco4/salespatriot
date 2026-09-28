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
import type { Feed } from "../lib/dibbs";
const formatDate = (value: string | null) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "Not provided";
export default function Home() {
  const [rows, setRows] = useState<Opportunity[]>([]),
    [feed, setFeed] = useState<Feed | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [filters, setFilters] = useState<Filters>(initialFilters),
    [view, setView] = useState("all"),
    [saved, setSaved] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [sort, setSort] = useState("due"),
    [selected, setSelected] = useState<Opportunity | null>(null);
  const run = useRef(0);
  const stop = useRef(false);
  const search = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("patriotbid-saved") || "[]"));
    } catch {}
    void sync();
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
  async function sync(date?: string, resume = false) {
    const id = ++run.current;
    stop.current = false;
    setLoading(true);
    setError("");
    let all: Opportunity[] = resume ? rows : [];
    const startPage = resume && feed ? feed.page + 1 : 1;
    try {
      for (let sourcePage = startPage; sourcePage <= 200; sourcePage++) {
        const response = await fetch(
          `/api/opportunities?page=${sourcePage}${date ? `&date=${date}` : ""}`,
        );
        const data = await response.json();
        if (id !== run.current) return;
        if (!response.ok)
          throw new Error(data.message || "Could not load DIBBS.");
        const next = data as Feed;
        date = next.date;
        all = [
          ...new Map([...all, ...next.rows].map((r) => [r.id, r])).values(),
        ];
        setRows(all);
        setFeed(next);
        if (sourcePage === 1) setPage(1);
        if (sourcePage >= next.pages || stop.current) break;
      }
    } catch (e) {
      if (id === run.current)
        setError(e instanceof Error ? e.message : "Could not load DIBBS.");
    } finally {
      if (id === run.current) setLoading(false);
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
  const complete = !!feed && feed.page >= feed.pages;
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
    a.download = `dibbs-${feed?.date || "rfqs"}.csv`;
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
              disabled={loading}
              onClick={() => void sync(feed?.date, !!feed && !complete)}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              {loading
                ? "Importing RFQs…"
                : feed && !complete
                  ? "Resume import"
                  : "Sync DIBBS"}
            </button>
          </div>
        </section>
        <section className="stats" aria-label="Listing overview">
          <div>
            <span className="stat-label">
              RFQs in this listing <Layers3 size={18} />
            </span>
            <strong>{feed?.total.toLocaleString() ?? "—"}</strong>
            <small>
              {feed
                ? `Issued ${feed.date.replaceAll("-", " / ")}`
                : "Connecting to DIBBS"}
            </small>
          </div>
          <div>
            <span className="stat-label">
              Loaded opportunities <PackageOpen size={18} />
            </span>
            <strong>{rows.length.toLocaleString()}</strong>
            <small>
              {complete
                ? "All source pages checked"
                : loading
                  ? "Importing remaining source pages…"
                  : "From the DIBBS source"}
            </small>
          </div>
          <div>
            <span className="stat-label">
              Due within 7 days <Clock3 size={18} />
            </span>
            <strong>
              {dueSoon.toLocaleString()}
              <span className="stat-tag">Time sensitive</span>
            </strong>
            <small>Among loaded opportunities</small>
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
                value={feed?.date || ""}
                disabled={loading || !feed}
                onChange={(e) => void sync(e.target.value)}
              >
                {!feed && <option>Latest available</option>}
                {feed?.dates.map((d) => (
                  <option key={d}>{d}</option>
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
                    ? `${active} active filter${active === 1 ? "" : "s"} · `
                    : ""}
                  {complete
                    ? "Across imported source pages"
                    : `Searching ${rows.length} loaded records${feed ? ` of ${feed.total}` : ""}`}
                </p>
              </div>
              <span className="open-tag">
                <span className="dot" />
                {loading
                  ? "Importing"
                  : complete
                    ? "Up to date"
                    : "DIBBS source"}
              </span>
            </div>
            {loading && (
              <div className="import-status" role="status">
                <RefreshCw size={14} className="spin" />
                <span>
                  {feed
                    ? `Importing page ${Math.min(feed.page + 1, feed.pages)} of ${feed.pages}. You can browse while the rest arrives.`
                    : "Establishing a DIBBS session and fetching the latest issue date…"}
                </span>
                <button
                  onClick={() => {
                    stop.current = true;
                  }}
                >
                  Stop after this page
                </button>
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                <strong>Import interrupted</strong>
                <span>
                  {error}{" "}
                  {rows.length > 0 ? "Loaded records remain available." : ""}
                </span>
                <button
                  disabled={loading}
                  onClick={() => void sync(feed?.date, !!feed && !complete)}
                >
                  Retry import
                </button>
              </div>
            )}
            {!loading && !complete && rows.length > 0 && !error && (
              <div className="import-status">
                Partial listing · {rows.length} records loaded. Sync DIBBS to
                import the full day.
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
                  {loading
                    ? "Finding your opportunities…"
                    : error && !rows.length
                      ? "DIBBS could not be reached"
                      : "No matching opportunities"}
                </h3>
                <p>
                  {loading
                    ? "Real RFQs will appear as soon as the first page arrives."
                    : "Try a different search, reset the filters, or select another issue date."}
                </p>
                {!loading && (
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
            {feed &&
              `· Retrieved ${new Date(feed.fetchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
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
