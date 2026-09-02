import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAllowedFauUrl, clearPageCache, fetchFauPage, fetchFauPageText, parseFauPage } from "../pageReader.js";

const originalEnvironment = process.env.NODE_ENV;
const originalFetch = globalThis.fetch;

afterEach(() => {
  process.env.NODE_ENV = originalEnvironment;
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  clearPageCache();
});

describe("FAU page reader security", () => {
  it("accepts FAU subdomains and rejects unsafe URL forms", () => {
    expect(assertAllowedFauUrl("https://www.fau.edu/registrar/")).toBe("https://www.fau.edu/registrar/");
    expect(() => assertAllowedFauUrl("https://fau.edu.example.com/")).toThrow(/public FAU/i);
    expect(() => assertAllowedFauUrl("https://user:pass@www.fau.edu/")).toThrow(/public FAU/i);
    expect(() => assertAllowedFauUrl("https://www.fau.edu:8443/")).toThrow(/public FAU/i);
    expect(() => assertAllowedFauUrl("http://www.fau.edu/")).toThrow(/public FAU/i);
    expect(() => assertAllowedFauUrl("file:///etc/passwd")).toThrow(/public FAU|valid/i);
    expect(() => assertAllowedFauUrl("https://127.0.0.1/")).toThrow(/public FAU/i);
  });

  it("preserves semantic sections, relative links, definitions, and table relationships", () => {
    const page = parseFauPage(`
      <html><head><title>CS Requirements</title><meta name="description" content="Official requirements">
      <link rel="canonical" href="/engineering/eecs/cs/"></head><body>
      <nav>Global navigation</nav><main><h1>Computer Science B.S.</h1><p>The program requires approved coursework.</p>
      <h2>Required Courses</h2><ul><li><a href="/catalog/cop-3000">COP 3000</a> — 3 credits</li></ul>
      <dl><dt>Minimum grade</dt><dd>C or better</dd></dl>
      <table><thead><tr><th>Course</th><th>Credits</th></tr></thead><tbody><tr><td>COP 3000</td><td>3</td></tr></tbody></table>
      <a href="https://example.com/unsafe">External</a></main><footer>Global footer</footer></body></html>
    `, "https://www.fau.edu/engineering/");

    expect(page.canonicalUrl).toBe("https://www.fau.edu/engineering/eecs/cs/");
    expect(page.text).not.toMatch(/Global navigation|Global footer/);
    expect(page.sections.find((section) => section.heading === "Required Courses")).toMatchObject({
      lists: [{ ordered: false, items: ["COP 3000 — 3 credits"] }],
      definitions: [{ term: "Minimum grade", definition: "C or better" }],
      tables: [{ headers: ["Course", "Credits"], rows: [["COP 3000", "3"]] }]
    });
    expect(page.links).toEqual([expect.objectContaining({
      text: "COP 3000",
      href: "https://www.fau.edu/catalog/cop-3000",
      sectionHeading: "Required Courses",
      surroundingContext: "COP 3000 — 3 credits"
    })]);
  });

  it("extracts official accordion content that is collapsed before interaction", () => {
    const page = parseFauPage(`
      <html><title>Registration FAQ</title><main><h1>Frequently Asked Questions</h1>
      <div class="toggle" role="button" aria-expanded="false">How do I adjust my schedule?</div>
      <div role="region" aria-hidden="true"><p>To withdraw from a course, follow these official steps.</p>
      <ul><li>Log in to MyFAU</li><li>Registration</li><li>Submit</li></ul></div>
      </main></html>
    `, "https://www.fau.edu/registrar/registration/faqs/");
    expect(page.sections.find((section) => section.heading === "How do I adjust my schedule?")).toMatchObject({
      paragraphs: ["To withdraw from a course, follow these official steps."],
      lists: [{ items: ["Log in to MyFAU", "Registration", "Submit"] }]
    });
  });

  it("validates every redirect hop and refuses redirects outside FAU", async () => {
    process.env.NODE_ENV = "development";
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: "https://example.com/private" }
    }));
    await expect(fetchFauPage("https://www.fau.edu/start", { fetchImpl })).rejects.toMatchObject({ status: 400, code: "invalid_fau_url" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("caches parsed pages by normalized URL and supports bypassing cache", async () => {
    process.env.NODE_ENV = "development";
    const html = "<html><title>FAU Page</title><main><h1>Requirements</h1><p>This is enough official FAU page content to be parsed and cached safely for repeated requests.</p></main></html>";
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status: 200, headers: { "content-type": "text/html" } })));
    const first = await fetchFauPage("https://www.fau.edu/page?utm_source=test", { fetchImpl });
    const second = await fetchFauPage("https://www.fau.edu/page", { fetchImpl });
    const third = await fetchFauPage("https://www.fau.edu/page", { fetchImpl, bypassCache: true });
    expect(first.cache).toBe("miss");
    expect(second.cache).toBe("hit");
    expect(third.cache).toBe("miss");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects non-HTML and pages without useful content", async () => {
    process.env.NODE_ENV = "development";
    await expect(fetchFauPage("https://www.fau.edu/file.pdf", {
      fetchImpl: vi.fn().mockResolvedValue(new Response("PDF", { status: 200, headers: { "content-type": "application/pdf" } }))
    })).rejects.toMatchObject({ status: 415, code: "non_html_page" });
    await expect(fetchFauPage("https://www.fau.edu/empty", {
      fetchImpl: vi.fn().mockResolvedValue(new Response("<html><main><h1>Empty</h1></main></html>", { status: 200, headers: { "content-type": "text/html" } }))
    })).rejects.toMatchObject({ status: 422, code: "no_useful_content" });
  });

  it("provides a pasted-text fallback message when FAU blocks retrieval", async () => {
    process.env.NODE_ENV = "development";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      headers: new Headers()
    });

    await expect(fetchFauPageText("https://www.fau.edu/registrar/"))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/paste the page text/i) });
  });

  it("turns page timeouts into a useful retry message", async () => {
    process.env.NODE_ENV = "development";
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    globalThis.fetch = vi.fn().mockRejectedValue(aborted);

    await expect(fetchFauPageText("https://www.fau.edu/registrar/"))
      .rejects.toMatchObject({ status: 408, message: expect.stringMatching(/too long/i) });
  });
});
