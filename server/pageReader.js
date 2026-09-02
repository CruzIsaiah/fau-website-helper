import * as cheerio from "cheerio";
import net from "node:net";

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const pageCache = new Map();

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function assertAllowedFauUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw httpError("Enter a valid public FAU HTTPS page URL.", 400, "invalid_fau_url");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const isFauHost = hostname === "fau.edu" || hostname.endsWith(".fau.edu");
  if (parsed.protocol !== "https:" || !isFauHost || net.isIP(hostname) || parsed.username || parsed.password || parsed.port) {
    throw httpError("Please enter a public FAU HTTPS page.", 400, "invalid_fau_url");
  }
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  return parsed.toString();
}

async function readLimitedText(response, maxBytes = DEFAULT_MAX_BYTES) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw httpError("That FAU page is too large to read automatically.", 413, "page_too_large");
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) throw httpError("That FAU page is too large to read automatically.", 413, "page_too_large");
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw httpError("That FAU page is too large to read automatically.", 413, "page_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function cleanText(value = "") {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function safeAbsoluteLink(href, baseUrl) {
  if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href.trim())) return null;
  try {
    const absolute = new URL(href, baseUrl);
    return assertAllowedFauUrl(absolute.toString());
  } catch {
    return null;
  }
}

function linkContext($, element) {
  const parentText = cleanText($(element).parent().text());
  return parentText.slice(0, 320);
}

export function parseFauPage(html, requestedUrl) {
  const safeUrl = assertAllowedFauUrl(requestedUrl);
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, template, [hidden], nav, footer, .footer, .site-footer, .cookie, .cookie-banner, .breadcrumbs, .breadcrumb, .social-links").remove();

  const title = cleanText($("title").first().text()) || cleanText($("h1").first().text()) || "FAU page";
  const description = cleanText($("meta[name='description']").attr("content") || "");
  const canonicalCandidate = $("link[rel='canonical']").attr("href");
  const canonicalUrl = safeAbsoluteLink(canonicalCandidate, safeUrl) || safeUrl;
  const main = $("main, [role='main'], #main-content, #content, .main-content, .content").first();
  const root = main.length ? main : $("body");
  const sections = [];
  const links = [];
  const seenLinks = new Set();
  let current = { heading: cleanText(root.find("h1").first().text()) || title, level: 1, paragraphs: [], lists: [], definitions: [], tables: [], links: [] };

  function finishSection() {
    const hasContent = current.paragraphs.length || current.lists.length || current.definitions.length || current.tables.length || current.links.length;
    if (hasContent) sections.push(current);
  }

  function captureLinks(element) {
    $(element).find("a[href]").addBack("a[href]").each((_index, anchor) => {
      const text = cleanText($(anchor).text());
      const href = safeAbsoluteLink($(anchor).attr("href"), canonicalUrl);
      if (!text || !href) return;
      const key = `${text}|${href}|${current.heading}`;
      if (seenLinks.has(key)) return;
      seenLinks.add(key);
      const link = { text, href, surroundingContext: linkContext($, anchor), sectionHeading: current.heading };
      links.push(link);
      current.links.push(link);
    });
  }

  root.find("h1, h2, h3, .toggle[role='button'], p, ul, ol, dl, table").each((_index, element) => {
    const tag = element.tagName?.toLowerCase();
    const isAccordionHeading = $(element).is(".toggle[role='button']");
    if (["h1", "h2", "h3"].includes(tag) || isAccordionHeading) {
      const heading = cleanText($(element).text());
      if (!heading) return;
      finishSection();
      current = { heading, level: isAccordionHeading ? 3 : Number(tag[1]), paragraphs: [], lists: [], definitions: [], tables: [], links: [] };
      captureLinks(element);
      return;
    }
    if ($(element).parents("li, table, dl").length && tag !== "table" && tag !== "dl") return;
    if (tag === "p") {
      const text = cleanText($(element).text());
      if (text.length >= 20) current.paragraphs.push(text);
    } else if (tag === "ul" || tag === "ol") {
      const items = $(element).children("li").map((_itemIndex, item) => cleanText($(item).clone().children("ul, ol").remove().end().text())).get().filter(Boolean);
      if (items.length) current.lists.push({ ordered: tag === "ol", items });
    } else if (tag === "dl") {
      const entries = [];
      let term = "";
      $(element).children("dt, dd").each((_definitionIndex, child) => {
        if (child.tagName?.toLowerCase() === "dt") term = cleanText($(child).text());
        else {
          const definition = cleanText($(child).text());
          if (term || definition) entries.push({ term, definition });
        }
      });
      if (entries.length) current.definitions.push(...entries);
    } else if (tag === "table") {
      const rows = [];
      $(element).find("tr").each((_rowIndex, row) => {
        const cells = [];
        $(row).children("th, td").each((_cellIndex, cell) => cells.push(cleanText($(cell).text())));
        if (cells.length) rows.push(cells);
      });
      if (rows.length) {
        const explicitHeaders = $(element).find("thead tr").first().children("th, td").map((_cellIndex, cell) => cleanText($(cell).text())).get();
        const firstHasHeaders = $(element).find("tr").first().children("th").length > 0;
        const headers = explicitHeaders.length ? explicitHeaders : firstHasHeaders ? rows[0] : [];
        if ((explicitHeaders.length || firstHasHeaders) && rows.length) rows.shift();
        current.tables.push({ heading: current.heading, headers, rows: rows.slice(0, 80) });
      }
    }
    captureLinks(element);
  });
  finishSection();

  const dedupedSections = sections.filter((section, index) => {
    const signature = `${section.heading}|${section.paragraphs.join(" ")}|${section.lists.flatMap((list) => list.items).join(" ")}`;
    return index === sections.findIndex((candidate) => `${candidate.heading}|${candidate.paragraphs.join(" ")}|${candidate.lists.flatMap((list) => list.items).join(" ")}` === signature);
  });
  const text = dedupedSections.map((section) => [
    section.heading,
    ...section.paragraphs,
    ...section.lists.flatMap((list) => list.items),
    ...section.definitions.flatMap((entry) => [entry.term, entry.definition]),
    ...section.tables.flatMap((table) => [table.headers.join(" | "), ...table.rows.map((row) => row.join(" | "))])
  ].filter(Boolean).join("\n")).join("\n\n");

  return { title, description, url: safeUrl, canonicalUrl, sections: dedupedSections, links, text: text.slice(0, 60_000) };
}

async function fetchHtmlWithRedirects(url, { signal, maxBytes, fetchImpl }) {
  let currentUrl = assertAllowedFauUrl(url);
  for (let hop = 0; hop <= 3; hop += 1) {
    const response = await fetchImpl(currentUrl, {
      signal,
      redirect: "manual",
      headers: { "User-Agent": "FAU-Website-Helper/2.0 (+independent navigation assistant)", Accept: "text/html,application/xhtml+xml" }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || hop === 3) throw httpError("The FAU page redirected too many times.", 400, "redirect_failed");
      currentUrl = assertAllowedFauUrl(new URL(location, currentUrl).toString());
      continue;
    }
    if (!response.ok) throw httpError("I found the official FAU page, but could not automatically read its content. Try another page or paste the page text.", 400, "page_fetch_failed");
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) throw httpError("That link is not a readable HTML page.", 415, "non_html_page");
    return { html: await readLimitedText(response, maxBytes), finalUrl: currentUrl, status: response.status };
  }
  throw httpError("The FAU page could not be retrieved.", 400, "page_fetch_failed");
}

export async function fetchFauPage(url, options = {}) {
  const normalizedUrl = assertAllowedFauUrl(url);
  const ttlMs = options.ttlMs ?? Number(process.env.FAU_PAGE_CACHE_TTL_MS || DEFAULT_TTL_MS);
  const bypassCache = options.bypassCache || process.env.FAU_PAGE_CACHE_BYPASS === "true";
  const cached = pageCache.get(normalizedUrl);
  if (!bypassCache && cached && Date.now() - cached.fetchedAt < ttlMs) return { ...cached.page, cache: "hit" };

  if (process.env.NODE_ENV === "test" && !options.fetchImpl) {
    return {
      title: "FAU test page",
      description: "",
      url: normalizedUrl,
      canonicalUrl: normalizedUrl,
      sections: [{ heading: "FAU information", level: 1, paragraphs: ["This FAU page includes important deadlines, official forms, contact information, and next steps for students."], lists: [], definitions: [], tables: [], links: [] }],
      links: [],
      text: "This FAU page includes important deadlines, official forms, contact information, and next steps for students.",
      cache: "test"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    const fetched = await fetchHtmlWithRedirects(normalizedUrl, {
      signal: controller.signal,
      maxBytes: options.maxBytes || DEFAULT_MAX_BYTES,
      fetchImpl: options.fetchImpl || globalThis.fetch
    });
    const page = { ...parseFauPage(fetched.html, fetched.finalUrl), httpStatus: fetched.status, fetchedAt: new Date().toISOString() };
    if (page.text.length < 80) throw httpError("I found the official FAU page, but could not extract useful content from it.", 422, "no_useful_content");
    pageCache.set(normalizedUrl, { page, fetchedAt: Date.now() });
    return { ...page, cache: "miss" };
  } catch (error) {
    if (error.name === "AbortError") throw httpError("That FAU page took too long to load. Try again or paste the page text.", 408, "page_timeout");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchFauPageText(url, options = {}) {
  const page = await fetchFauPage(url, options);
  return { ...page, text: page.text.slice(0, 60_000) };
}

export function htmlToReadableText(html, url = "https://www.fau.edu/") {
  const page = parseFauPage(html, url);
  return { title: page.title, text: page.text };
}

export function clearPageCache(url) {
  if (url) pageCache.delete(assertAllowedFauUrl(url));
  else pageCache.clear();
}

export function getPageCacheStats() {
  return { entries: pageCache.size, urls: [...pageCache.keys()] };
}
