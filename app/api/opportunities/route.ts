import { fetchDailyRfqs, type Feed } from "../../../lib/dibbs";
import type { Opportunity } from "../../../lib/opportunities";
import {
  loadDates,
  loadDay,
  saveDates,
  saveDay,
  savedPastDay,
} from "../../../lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;
const cache = new Map<string, { feed: Feed; at: number }>();
const pending = new Map<string, Promise<Feed>>();

function isOpportunity(value: unknown): value is Opportunity {
  if (!value || typeof value !== "object") return false;
  const row = value as Opportunity;
  return (
    typeof row.id === "string" &&
    typeof row.solicitation === "string" &&
    typeof row.nsn === "string" &&
    typeof row.title === "string" &&
    typeof row.url === "string" &&
    row.url.startsWith("https://www.dibbs.bsm.dla.mil/")
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") || undefined;
  const pageParam = params.get("page");
  if (date && !/^\d{2}-\d{2}-\d{4}$/.test(date))
    return Response.json({ message: "Invalid date or page." }, { status: 400 });

  if (pageParam) {
    const page = Number(pageParam);
    if (!Number.isInteger(page) || page < 1 || page > 200)
      return Response.json(
        { message: "Invalid date or page." },
        { status: 400 },
      );
    const saved = date ? savedPastDay(date) : null;
    if (saved)
      return Response.json(
        {
          stored: true,
          skipped: true,
          date: saved.date,
          rows: saved.rows,
          total: saved.total,
          pages: 1,
          fetchedAt: saved.fetchedAt,
          source: saved.source,
          dates: loadDates(),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    const key = `${date || "latest"}:${page}`;
    const entry = cache.get(key);
    if (entry && Date.now() - entry.at < 300000)
      return Response.json(
        { ...entry.feed, cached: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    try {
      if (!pending.has(key)) pending.set(key, fetchDailyRfqs(date, page));
      const feed = await pending.get(key)!;
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(key, { feed, at: Date.now() });
      if (page === 1 && feed.dates.length) saveDates(feed.dates);
      return Response.json(
        { ...feed, cached: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      return Response.json(
        {
          message:
            error instanceof Error ? error.message : "Unable to contact DIBBS.",
        },
        { status: 502 },
      );
    } finally {
      pending.delete(key);
    }
  }

  const dates = loadDates();
  const selected = date || dates[0] || "";
  const day = selected ? loadDay(selected) : null;
  return Response.json(
    {
      dates,
      date: selected,
      rows: day?.rows ?? [],
      total: day?.total ?? 0,
      pages: day?.pages ?? 0,
      fetchedAt: day?.fetchedAt ?? null,
      source: day?.source ?? "",
      stored: !!day,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid listing." }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return Response.json({ message: "Invalid listing." }, { status: 400 });
  const data = body as Record<string, unknown>;
  if (typeof data.date !== "string" || !/^\d{2}-\d{2}-\d{4}$/.test(data.date))
    return Response.json({ message: "Invalid date." }, { status: 400 });
  if (!Array.isArray(data.rows) || data.rows.length > 20000)
    return Response.json({ message: "Invalid listing." }, { status: 400 });
  const rows = data.rows.filter(isOpportunity);
  const existing = savedPastDay(data.date);
  if (existing)
    return Response.json(
      {
        ok: true,
        skipped: true,
        date: existing.date,
        count: existing.rows.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  saveDay({
    date: data.date,
    rows,
    total: typeof data.total === "number" ? data.total : rows.length,
    pages: typeof data.pages === "number" ? data.pages : 1,
    fetchedAt:
      typeof data.fetchedAt === "string"
        ? data.fetchedAt
        : new Date().toISOString(),
    source: typeof data.source === "string" ? data.source : "",
  });
  if (Array.isArray(data.dates))
    saveDates(data.dates.filter((date): date is string => typeof date === "string"));
  return Response.json(
    { ok: true, date: data.date, count: rows.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
