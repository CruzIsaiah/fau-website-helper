export function assertAllowedFauUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || (!hostname.endsWith("fau.edu") && hostname !== "fau.edu")) {
    const error = new Error("Please enter a public FAU HTTPS page.");
    error.status = 400;
    throw error;
  }
  return parsed.toString();
}

export function htmlToReadableText(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  return { title, text: text.slice(0, 6000) };
}

export async function fetchFauPageText(url) {
  if (process.env.NODE_ENV === "test") {
    return {
      title: "FAU test page",
      text: "This FAU page includes important deadlines, official forms, contact information, and next steps for students."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(assertAllowedFauUrl(url), {
      signal: controller.signal,
      headers: {
        "User-Agent": "FAU-Website-Helper/1.0"
      }
    });

    if (!response.ok) {
      const error = new Error("I could not open that FAU page. Try another public FAU link or paste the page text.");
      error.status = 400;
      throw error;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      const error = new Error("That link does not look like a readable web page. Try another FAU page or paste the text.");
      error.status = 400;
      throw error;
    }

    const page = htmlToReadableText(await response.text());
    if (page.text.length < 80) {
      const error = new Error("I could not find enough readable text on that page. Paste the page text instead.");
      error.status = 400;
      throw error;
    }
    return page;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("That FAU page took too long to load. Try again or paste the page text.");
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
