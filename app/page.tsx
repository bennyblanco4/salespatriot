"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Building2,
  CalendarDays,
  Clock3,
  Heart,
  MapPin,
  Medal,
  PackageOpen,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlock,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  daysLeft,
  filterRows,
  initialFilters,
  isPastIssueDate,
  pdfLink,
  type Filters,
  type Opportunity,
} from "../lib/opportunities";
type Listing = {
  date: string;
  total: number;
  fetchedAt: string | null;
  stored: boolean;
};
function setAsideName(value: string) {
  return value.replace(/\s+set-aside$/i, "").trim();
}
function setAsideParts(value: string): { label: string; icon: LucideIcon }[] {
  const text = value.toLowerCase();
  const parts: { label: string; icon: LucideIcon }[] = [];
  if (text.includes("veteran")) parts.push({ label: "Veteran", icon: Medal });
  if (text.includes("woman"))
    parts.push({ label: "Woman owned", icon: Heart });
  if (text.includes("hubzone")) parts.push({ label: "HUBZone", icon: MapPin });
  if (/8\s*\(?a\)?/.test(text)) parts.push({ label: "8(a)", icon: Building2 });
  if (text.includes("small business"))
    parts.push({ label: "Small business", icon: Users });
  if (text.includes("unrestricted"))
    parts.push({ label: "Unrestricted", icon: Unlock });
  return parts;
}
function SetAsideLabel({ value }: { value: string }) {
  const parts = setAsideParts(value);
  const boxes =
    parts.length > 0
      ? parts
      : [{ label: setAsideName(value) || "Not specified", icon: null }];
  return (
    <span className="set-asides">
      {boxes.map((part) => {
        const Icon = part.icon;
        return (
          <span
            key={part.label}
            className={`badge ${part.label === "Unrestricted" ? "neutral" : "blue"}`}
          >
            {Icon ? <Icon size={12} aria-hidden="true" /> : null}
            {part.label}
          </span>
        );
      })}
    </span>
  );
}
const formatDate = (value: string | null) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "Not provided";
const formatFullDate = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
function issueToIso(value: string) {
  const [month, day, year] = value.split("-");
  return `${year}-${month}-${day}`;
}
function isoToIssue(value: string) {
  const [year, month, day] = value.split("-");
  return `${month}-${day}-${year}`;
}
function monthStart(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}
function toIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function DateMenu({
  label,
  value,
  onChange,
  allowed,
  emptyLabel,
  clearLabel,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  allowed?: string[];
  emptyLabel?: string;
  clearLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(() =>
    value ? monthStart(value) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  useEffect(() => {
    if (open && value) setCursor(monthStart(value));
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const allowedSet = allowed ? new Set(allowed) : null;
  return (
    <div className="date-field" ref={root}>
      <span>{label}</span>
      <button
        type="button"
        className="date-button"
        aria-label={label}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value ? formatFullDate(value) : emptyLabel}</span>
        <CalendarDays size={14} />
      </button>
      {open && (
        <div className="calendar" role="dialog" aria-label={`${label} calendar`}>
          <div className="calendar-head">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <strong>
              {cursor.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="calendar-week">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: leading }, (_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const iso = toIso(new Date(year, month, index + 1));
              const blocked = allowedSet ? !allowedSet.has(iso) : false;
              return (
                <button
                  type="button"
                  key={iso}
                  disabled={blocked}
                  className={iso === value ? "selected" : ""}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          {clearLabel && (
            <button
              type="button"
              className="calendar-clear"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function OptionIcons({ icons }: { icons?: LucideIcon[] }) {
  if (!icons?.length) return null;
  return (
    <span className="menu-icons">
      {icons.map((Icon, index) => (
        <Icon key={`${index}`} size={12} aria-hidden="true" />
      ))}
    </span>
  );
}
function OptionMenu({
  label,
  value,
  placeholder,
  options,
  onChange,
  search,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string; icons?: LucideIcon[] }[];
  onChange: (value: string) => void;
  search?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    root = useRef<HTMLDivElement>(null),
    searchBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const frame = requestAnimationFrame(() => searchBox.current?.focus());
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const selected = options.find((option) => option.value === value);
  const needle = query.trim().toLowerCase();
  const shown = options.filter(
    (option) =>
      !needle ||
      option.label.toLowerCase().includes(needle) ||
      option.value.toLowerCase().includes(needle),
  );
  return (
    <div className="date-field" ref={root}>
      <span>{label}</span>
      <button
        type="button"
        className="date-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="menu-value">
          {selected ? <OptionIcons icons={selected.icons} /> : null}
          <span>{selected?.label || placeholder}</span>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="option-menu" role="listbox" aria-label={label}>
          {search && (
            <input
              ref={searchBox}
              className="menu-search"
              placeholder="Search"
              value={query}
              aria-label={`Search ${label}`}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
          <button
            type="button"
            className={value ? "" : "selected"}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {placeholder}
          </button>
          <div className="option-list">
            {shown.map((option) => (
              <button
                type="button"
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "selected" : ""}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <OptionIcons icons={option.icons} />
                <span>{option.label}</span>
              </button>
            ))}
            {!shown.length && <p className="menu-empty">No matches</p>}
          </div>
        </div>
      )}
    </div>
  );
}
type Sort = { key: "title" | "quantity" | "docs" | "due"; dir: "asc" | "desc" };
function compareRows(a: Opportunity, b: Opportunity, sort: Sort) {
  const dir = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "title") return a.title.localeCompare(b.title) * dir;
  if (sort.key === "quantity") {
    if (a.quantity == null && b.quantity == null) return 0;
    if (a.quantity == null) return 1;
    if (b.quantity == null) return -1;
    return (a.quantity - b.quantity) * dir;
  }
  if (sort.key === "docs")
    return (Number(a.docs === true) - Number(b.docs === true)) * dir;
  return (
    (Number((daysLeft(a.due) ?? 0) < 0) - Number((daysLeft(b.due) ?? 0) < 0) ||
      (a.due || "9999").localeCompare(b.due || "9999")) * dir
  );
}
function OpportunityCard({
  row,
  saved,
  onSave,
  onOpen,
}: {
  row: Opportunity;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  const days = daysLeft(row.due);
  const pdf = row.pdf || pdfLink(row.solicitation);
  const past = days !== null && days < 0;
  return (
    <article className={`opp-card${past ? " past" : ""}`}>
      <div className="opp-card-top">
        <button
          type="button"
          className={`save${saved ? " saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${row.title}`}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
        <div className="item">
          <button type="button" onClick={onOpen}>
            {row.title}
          </button>
          <span className="mono">
            {row.nsn} <em>FSC {row.fsc}</em>
          </span>
          <small>
            {row.solicitation} · PR {row.purchaseRequest}
          </small>
        </div>
        <a
          className="external"
          href={row.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${row.solicitation} on DIBBS`}
        >
          <ArrowUpRight size={18} />
        </a>
      </div>
      <div className="opp-facts">
        <div>
          <span>Quantity</span>
          <strong>{row.quantity?.toLocaleString() ?? "—"}</strong>
          <small>{row.unit || "See package for unit"}</small>
        </div>
        <div className="due">
          <span>Return by</span>
          <strong>{formatDate(row.due)}</strong>
          {past ? (
            <span className="badge red">
              <Clock3 size={12} aria-hidden="true" />
              Past due
            </span>
          ) : (
            <small className={days !== null && days <= 3 ? "urgent" : ""}>
              {days === null
                ? "Check source"
                : days === 0
                  ? "Due today"
                  : `${days} days left`}
            </small>
          )}
        </div>
        <div>
          <span>Tech docs</span>
          {row.docs ? (
            <span className="docs">
              <FileText size={14} /> Available
            </span>
          ) : (
            <strong className="muted">
              {row.docs === false ? "None listed" : "Unknown"}
            </strong>
          )}
        </div>
        <div>
          <span>PDF</span>
          {pdf ? (
            <a
              className="pdf-link"
              href={pdf}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${row.solicitation} PDF`}
            >
              <FileText size={14} /> Open PDF
            </a>
          ) : (
            <strong className="muted">None</strong>
          )}
        </div>
      </div>
      <SetAsideLabel value={row.setAside} />
    </article>
  );
}
function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: Sort["key"];
  sort: Sort;
  onSort: (key: Sort["key"]) => void;
}) {
  const active = sort.key === column;
  return (
    <th aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        className={`sort-col${active ? " active" : ""}`}
        onClick={() => onSort(column)}
      >
        {label}
        <ChevronDown
          size={11}
          className={active && sort.dir === "asc" ? "up" : ""}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}
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
    [sort, setSort] = useState<Sort>({ key: "due", dir: "asc" }),
    [selected, setSelected] = useState<Opportunity | null>(null),
    [filtersOpen, setFiltersOpen] = useState(false);
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
    if (isPastIssueDate(date) && listing?.stored && listing.date === date) return;
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
        if (data.skipped) {
          setRows(data.rows || []);
          setListing({
            date,
            total: data.total || 0,
            fetchedAt: data.fetchedAt || null,
            stored: true,
          });
          return;
        }
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
  function chooseSort(key: Sort["key"]) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "docs" || key === "quantity" ? "desc" : "asc" },
    );
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
      filterRows(rows, { ...filters, setAside: "" })
        .filter(
          (r) =>
            !filters.setAside ||
            setAsideParts(r.setAside).some(
              (part) => part.label === filters.setAside,
            ),
        )
        .filter((r) => view !== "saved" || saved.includes(r.id))
        .sort((a, b) => compareRows(a, b, sort)),
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
      "pdf",
    ] as const;
    const csv = [
      keys.join(","),
      ...filtered.map((r) =>
        keys
          .map((k) => {
            const value =
              k === "pdf" ? r.pdf || pdfLink(r.solicitation) : r[k];
            return (
              '"' +
              String(value ?? "")
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"'
            );
          })
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
          </div>
        </section>
        <section className="stats" aria-label="Listing overview">
          <div>
            <span className="stat-label">
              Opportunities <PackageOpen size={18} />
            </span>
            <strong>{rows.length.toLocaleString()}</strong>
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
          <button
            type="button"
            className="filters-toggle"
            aria-expanded={filtersOpen}
            aria-controls="refine-panel"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <span className="filters-toggle-label">
              <Filter size={16} />
              {filtersOpen ? "Hide filters" : "Refine results"}
              {active > 0 ? <span className="count">{active}</span> : null}
            </span>
            <span className="filters-toggle-meta">
              {listing?.date
                ? listing.date.replaceAll("-", " / ")
                : "Issue date"}
              <ChevronDown
                size={16}
                className={filtersOpen ? "up" : ""}
                aria-hidden="true"
              />
            </span>
          </button>
          <aside
            id="refine-panel"
            className={`filters${filtersOpen ? " open" : ""}`}
          >
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
            <DateMenu
              label="Issue date"
              value={listing?.date ? issueToIso(listing.date) : ""}
              allowed={dateOptions.map(issueToIso)}
              emptyLabel="Loading dates…"
              disabled={!dateOptions.length}
              onChange={(iso) => void choose(isoToIssue(iso))}
            />
            <DateMenu
              label="Quote deadline"
              value={filters.due}
              emptyLabel="Any deadline"
              clearLabel="Any deadline"
              onChange={(iso) => update("due", iso)}
            />
            <div className="divider" />
            <OptionMenu
              label="Federal supply class"
              value={filters.fsc}
              placeholder="All categories"
              search
              options={[...new Set(rows.map((r) => r.fsc))].sort().map((f) => ({
                value: f,
                label: `FSC ${f}`,
              }))}
              onChange={(fsc) => update("fsc", fsc)}
            />
            <OptionMenu
              label="Set-aside"
              value={filters.setAside}
              placeholder="All set-asides"
              options={setAsideParts(rows.map((r) => r.setAside).join(" ")).map(
                (part) => ({
                  value: part.label,
                  label: part.label,
                  icons: [part.icon],
                }),
              )}
              onChange={(setAside) => update("setAside", setAside)}
            />
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
              <label className="mobile-sort">
                Sort
                <select
                  aria-label="Sort opportunities"
                  value={`${sort.key}:${sort.dir}`}
                  onChange={(event) => {
                    const [key, dir] = event.target.value.split(":") as [
                      Sort["key"],
                      Sort["dir"],
                    ];
                    setSort({ key, dir });
                    setPage(1);
                  }}
                >
                  <option value="due:asc">Return by, soonest</option>
                  <option value="due:desc">Return by, latest</option>
                  <option value="title:asc">Item name, A to Z</option>
                  <option value="title:desc">Item name, Z to A</option>
                  <option value="quantity:desc">Quantity, high to low</option>
                  <option value="quantity:asc">Quantity, low to high</option>
                  <option value="docs:desc">Tech docs available first</option>
                  <option value="docs:asc">Tech docs available last</option>
                </select>
              </label>
              <div className="freshness">
                <span className="open-tag">
                  <span className="dot" />
                  {syncing
                    ? "Updating"
                    : listing?.stored
                      ? "Up to date"
                      : "DIBBS"}
                </span>
                <button
                  className="refresh"
                  aria-label={
                    listing?.stored && isPastIssueDate(listing.date)
                      ? "Past issue date already saved"
                      : syncing
                        ? "Updating this issue date"
                        : "Update this issue date"
                  }
                  disabled={
                    syncing ||
                    !listing?.date ||
                    (listing.stored && isPastIssueDate(listing.date))
                  }
                  onClick={() => {
                    if (!listing?.date) return;
                    void pull(listing.date, ++run.current, true);
                  }}
                >
                  <RefreshCw size={14} className={syncing ? "spin" : ""} />
                </button>
              </div>
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
                    <SortHeader
                      label="ITEM / NSN"
                      column="title"
                      sort={sort}
                      onSort={chooseSort}
                    />
                    <SortHeader
                      label="QUANTITY"
                      column="quantity"
                      sort={sort}
                      onSort={chooseSort}
                    />
                    <th>SET-ASIDE</th>
                    <SortHeader
                      label="TECH DOCS"
                      column="docs"
                      sort={sort}
                      onSort={chooseSort}
                    />
                    <th>PDF</th>
                    <SortHeader
                      label="RETURN BY"
                      column="due"
                      sort={sort}
                      onSort={chooseSort}
                    />
                    <th>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const days = daysLeft(r.due);
                    const pdf = r.pdf || pdfLink(r.solicitation);
                    return (
                      <tr
                        key={r.id}
                        className={days !== null && days < 0 ? "past" : ""}
                      >
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
                          <SetAsideLabel value={r.setAside} />
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
                        <td>
                          {pdf ? (
                            <a
                              className="pdf-link"
                              href={pdf}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${r.solicitation} PDF`}
                            >
                              <FileText size={14} />
                            </a>
                          ) : (
                            <span className="muted">None</span>
                          )}
                        </td>
                        <td className="due">
                          <strong>{formatDate(r.due)}</strong>
                          {days !== null && days < 0 ? (
                            <span className="badge red">
                              <Clock3 size={12} aria-hidden="true" />
                              Past due
                            </span>
                          ) : (
                            <small
                              className={
                                days !== null && days <= 3 ? "urgent" : ""
                              }
                            >
                              {days === null
                                ? "Check source"
                                : days === 0
                                  ? "Due today"
                                  : `${days} days left`}
                            </small>
                          )}
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
            <div className="opp-cards">
              {visible.map((row) => (
                <OpportunityCard
                  key={row.id}
                  row={row}
                  saved={saved.includes(row.id)}
                  onSave={() => toggleSaved(row.id)}
                  onOpen={() => show(row)}
                />
              ))}
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
                  <dd>
                    {k === "Set-aside" ? (
                      <SetAsideLabel value={v} />
                    ) : k === "Return by" &&
                      (daysLeft(selected.due) ?? 0) < 0 ? (
                      <span className="past-date">
                        {v}
                        <span className="badge red">
                          <Clock3 size={12} aria-hidden="true" />
                          Past due
                        </span>
                      </span>
                    ) : (
                      v
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="detail-note">
              Confirm the unit of issue, delivery schedule, specifications, and
              eligibility in the original solicitation.
            </p>
            <div className="detail-actions">
              {(selected.pdf || pdfLink(selected.solicitation)) && (
                <a
                  className="button"
                  href={selected.pdf || pdfLink(selected.solicitation) || undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open solicitation PDF <FileText size={16} />
                </a>
              )}
              <a
                className="button primary"
                href={selected.url}
                target="_blank"
                rel="noreferrer"
              >
                View original DIBBS package <ArrowUpRight size={16} />
              </a>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
