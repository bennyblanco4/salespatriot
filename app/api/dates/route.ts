import { listIssueDates } from "../../../lib/dibbs";
import { loadDates, saveDates } from "../../../lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const dates = await listIssueDates();
    if (!dates.length) throw new Error("No issue dates were published.");
    saveDates(dates);
    return Response.json(
      { dates },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const dates = loadDates();
    if (dates.length)
      return Response.json(
        { dates, cached: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not load issue dates.",
      },
      { status: 502 },
    );
  }
}
