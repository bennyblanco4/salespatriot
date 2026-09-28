import { fetchDailyRfqs, type Feed } from "../../../lib/dibbs";
export const runtime = "nodejs";
export const maxDuration = 120;
const cache = new Map<string, { feed: Feed; at: number }>();
const pending = new Map<string, Promise<Feed>>();
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") || undefined;
  const page = Number(params.get("page") || 1);
  if (
    (date && !/^\d{2}-\d{2}-\d{4}$/.test(date)) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 200
  )
    return Response.json({ message: "Invalid date or page." }, { status: 400 });
  const key = `${date || "latest"}:${page}`;
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < 300000)
    return Response.json({ ...entry.feed, cached: true });
  try {
    if (!pending.has(key)) pending.set(key, fetchDailyRfqs(date, page));
    const feed = await pending.get(key)!;
    if (cache.size >= 300) cache.delete(cache.keys().next().value!);
    cache.set(key, { feed, at: Date.now() });
    return Response.json({ ...feed, cached: false });
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
