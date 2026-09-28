import * as cheerio from "cheerio";
import type { Opportunity } from "./opportunities";
export const SOURCE =
  "https://www.dibbs.bsm.dla.mil/RFQ/RFQDates.aspx?category=issue";
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
function date(s: string): string | null {
  const m = s.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}
export function safeLink(href: string, base = SOURCE): string | null {
  try {
    const u = new URL(href, base);
    return u.protocol === "https:" && u.hostname === "www.dibbs.bsm.dla.mil"
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function parseRfqHtml(html: string, base = SOURCE): Opportunity[] {
  const $ = cheerio.load(html);
  const rows: Opportunity[] = [];
  $('[id$="_lblNsn"]').each((_, el) => {
    const row = $(el).closest("tr");
    const field = (suffix: string) => row.find(`[id$="_${suffix}"]`);
    const nsn = normalize($(el).text());
    const sol = field("lblSolicitation");
    const solicitation = sol.find("a").first().text().trim();
    const href = sol
      .find("a")
      .filter((_, a) => /\/rfqrec\.aspx\?/i.test($(a).attr("href") || ""))
      .first()
      .attr("href");
    const url = href ? safeLink(href, base) : null;
    if (!solicitation || !nsn || !url) return;
    const aside = sol
      .find("img")
      .map((_, img) => $(img).attr("alt") || "")
      .get()
      .find((s) =>
        /set.aside|small business|HUBZone|woman.owned|veteran.owned/i.test(s),
      );
    const qty = field("lblPr")
      .text()
      .match(/QTY:\s*([\d,]+(?:\.\d+)?)/i)?.[1];
    const docs = normalize(field("lblTechnicalDocuments").text());
    rows.push({
      purchaseRequest: field("lblPr").text().match(/^\d+/)?.[0] || "",
      id: `${solicitation}:${nsn}:${field("lblPr").text().match(/^\d+/)?.[0] || ""}`,
      solicitation,
      nsn,
      fsc: /^\d{4}-\d{2}-\d{3}-\d{4}$|^\d{13}$/.test(nsn)
        ? nsn.slice(0, 4)
        : "Other",
      title:
        normalize(field("lblNomenclature").text()) ||
        "Description not provided",
      quantity: qty ? Number(qty.replaceAll(",", "")) : null,
      unit: "",
      setAside: aside
        ? /Unrestricted/i.test(aside)
          ? "Unrestricted"
          : normalize(aside)
        : "Not specified",
      issued: date(field("lblIssued").text()),
      due: date(field("lblReturnBy").text()),
      docs: docs ? !/^none$/i.test(docs) : null,
      status:
        normalize(field("lblStatus").find("span").first().text()) || "Unknown",
      url,
    });
  });
  return [...new Map(rows.map((r) => [r.id, r])).values()];
}
export function readIssueLinks(html: string) {
  const $ = cheerio.load(html);
  const links = $("a[href]")
    .map((_, a) => $(a).attr("href")!)
    .get()
    .filter((h) => /RfqRecs\.aspx\?category=issue/i.test(h));
  const dates = [
    ...new Set(
      links
        .map((h) => new URL(h, SOURCE).searchParams.get("Value"))
        .filter((s): s is string => !!s),
    ),
  ];
  return { links, dates };
}
export async function listIssueDates(): Promise<string[]> {
  const session = new DibbsSession();
  const listing = await session.page(SOURCE);
  return readIssueLinks(listing.html).dates;
}
export function formFields(html: string) {
  const $ = cheerio.load(html);
  const data = new URLSearchParams();
  $("input[type=hidden][name]").each((_, el) => {
    data.set($(el).attr("name")!, $(el).attr("value") || "");
  });
  return data;
}
class DibbsSession {
  cookies = new Map<string, string>();
  async request(
    url: string,
    body?: URLSearchParams,
    depth = 0,
  ): Promise<{ html: string; url: string }> {
    if (depth > 6) throw new Error("DIBBS redirected too many times.");
    if (!safeLink(url)) throw new Error("Unexpected source URL.");
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(25000),
      headers: {
        "User-Agent": "PatriotBid/1.0",
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      cache: "no-store",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const index = pair.indexOf("=");
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Missing DIBBS redirect.");
      return this.request(new URL(location, url).href, undefined, depth + 1);
    }
    if (!response.ok)
      throw new Error(`DIBBS returned HTTP ${response.status}.`);
    return { html: await response.text(), url };
  }
  async page(url: string, body?: URLSearchParams) {
    let result = await this.request(url, body);
    if (result.html.includes('id="butAgree"')) {
      const $ = cheerio.load(result.html);
      const fields = formFields(result.html);
      fields.set("butAgree", "OK");
      result = await this.request(
        new URL($("form").attr("action") || result.url, result.url).href,
        fields,
      );
      if (result.html.includes('id="butAgree"'))
        throw new Error(
          "DIBBS did not establish a public session. Please retry.",
        );
    }
    return result;
  }
}
export type Feed = {
  rows: Opportunity[];
  total: number;
  page: number;
  pages: number;
  date: string;
  dates: string[];
  fetchedAt: string;
  source: string;
};
const sessions = new Map<
  string,
  {
    session: DibbsSession;
    html: string;
    firstHtml: string;
    url: string;
    dates: string[];
    at: number;
  }
>();
async function fetchDailyRfqsInternal(
  issueDate?: string,
  page = 1,
): Promise<Feed> {
  let saved = issueDate ? sessions.get(issueDate) : undefined;
  if (saved && Date.now() - saved.at > 300000) {
    sessions.delete(issueDate!);
    saved = undefined;
  }
  if (!saved) {
    const session = new DibbsSession();
    const listing = await session.page(SOURCE);
    const { links, dates } = readIssueLinks(listing.html);
    const selected = issueDate || dates[0];
    if (!selected || !dates.includes(selected))
      throw new Error("No daily listing is available for this date.");
    const url = safeLink(
      links.find(
        (h) => new URL(h, SOURCE).searchParams.get("Value") === selected,
      )!,
    )!;
    const result = await session.page(url);
    saved = {
      session,
      html: result.html,
      firstHtml: result.html,
      url,
      dates,
      at: Date.now(),
    };
    if (sessions.size >= 5) sessions.delete(sessions.keys().next().value!);
    sessions.set(selected, saved);
    issueDate = selected;
  }
  const knownTotal = Number(
    cheerio
      .load(saved.html)('[id$="_lblRecCount"]')
      .text()
      .replace(/[^\d]/g, ""),
  );
  if (page > Math.max(1, Math.ceil(knownTotal / 50)))
    throw new Error("Requested page exceeds this daily listing.");
  let html = page === 1 ? saved.firstHtml : saved.html;
  if (page > 1) {
    for (let hop = 0; hop < 25; hop++) {
      const $ = cheerio.load(html);
      const total = Number(
        $('[id$="_lblRecCount"]').text().replace(/[^\d]/g, ""),
      );
      const currentPage = Number(
        $("tr.pagination").first().find("span").first().text(),
      );
      if (currentPage === page) break;
      const actions = $("a[href]")
        .map((_, a) => $(a).attr("href")!)
        .get()
        .map((h) => h.match(/'Page\$(\d+|Last|First)'/)?.[1])
        .filter((s): s is string => !!s);
      let action = actions.includes(String(page))
        ? String(page)
        : page === Math.ceil(total / 50) && actions.includes("Last")
          ? "Last"
          : undefined;
      if (!action) {
        const steps = actions
          .map(Number)
          .filter((n) => Number.isFinite(n) && n < page);
        action = steps.length ? String(Math.max(...steps)) : "First";
      }
      const fields = formFields(html);
      fields.set("__EVENTTARGET", "ctl00$cph1$grdRfqSearch");
      fields.set("__EVENTARGUMENT", `Page$${action}`);
      html = (await saved.session.page(saved.url, fields)).html;
      if (!cheerio.load(html)('[id$="_lblRecCount"]').length)
        throw new Error("DIBBS interrupted this page. Please try again.");
      saved.html = html;
      saved.at = Date.now();
      if (action === String(page) || action === "Last") break;
      if (hop === 24)
        throw new Error("Unable to reach the requested source page.");
    }
  }
  const $ = cheerio.load(html);
  const total = Number($('[id$="_lblRecCount"]').text().replace(/[^\d]/g, ""));
  const actualPage =
    Number($("tr.pagination").first().find("span").first().text()) || 1;
  if (actualPage !== page)
    throw new Error(
      "DIBBS returned a different page. Please try again.",
    );
  const rows = parseRfqHtml(html, saved.url);
  if (!rows.length && total !== 0)
    throw new Error("DIBBS returned an unrecognized records page.");
  if (!$('[id$="_lblRecCount"]').length)
    throw new Error("DIBBS did not return its RFQ listing. Please retry.");
  return {
    rows,
    total,
    page,
    pages: Math.ceil(total / 50),
    date: issueDate!,
    dates: saved.dates,
    fetchedAt: new Date().toISOString(),
    source: saved.url,
  };
}

// ASP.NET keeps paging state in the session. Serialize imports to prevent
// simultaneous browser tabs from changing that state beneath one another.
let importQueue: Promise<unknown> = Promise.resolve();
export function fetchDailyRfqs(issueDate?: string, page = 1): Promise<Feed> {
  const result = importQueue.then(() =>
    fetchDailyRfqsInternal(issueDate, page),
  );
  importQueue = result.catch(() => undefined);
  return result;
}
