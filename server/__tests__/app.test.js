import { Readable, Writable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { resetDb } from "../db.js";

const app = createApp();

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = Readable.from(payload ? [payload] : []);
    const headers = {
      host: "localhost",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload)
    };

    Object.assign(req, {
      method,
      url,
      originalUrl: url,
      headers,
      connection: {},
      socket: {}
    });

    let responseBody = "";
    const responseHeaders = {};
    const res = new Writable({
      write(chunk, _encoding, callback) {
        responseBody += chunk.toString();
        callback();
      }
    });

    Object.assign(res, {
      statusCode: 200,
      headersSent: false,
      locals: {},
      req,
      setHeader(name, value) {
        responseHeaders[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return responseHeaders[name.toLowerCase()];
      },
      getHeaders() {
        return responseHeaders;
      },
      removeHeader(name) {
        delete responseHeaders[name.toLowerCase()];
      },
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        Object.entries(headers).forEach(([name, value]) => this.setHeader(name, value));
        this.headersSent = true;
        return this;
      },
      end(chunk) {
        if (chunk) responseBody += chunk.toString();
        this.headersSent = true;
        resolve({
          status: this.statusCode,
          body: responseBody ? JSON.parse(responseBody) : {},
          text: responseBody,
          headers: responseHeaders
        });
        return this;
      }
    });

    app.handle(req, res, reject);
  });
}

beforeEach(() => {
  resetDb();
});

describe("resources", () => {
  it("lists curated FAU resources", async () => {
    const response = await request("GET", "/api/resources");

    expect(response.status).toBe(200);
    expect(response.body.resources.length).toBeGreaterThan(5);
  });
});

describe("ai endpoints", () => {
  it("returns AI resource matches", async () => {
    const response = await request("POST", "/api/ai/find", { question: "Where do I pay tuition?" });

    expect(response.status).toBe(200);
    expect(response.body.matches[0].resourceId).toBeTruthy();
  });

  it("returns a structured research response without losing ranked resources", async () => {
    const response = await request("POST", "/api/ai/research", { question: "CS degree requirements" });
    expect(response.status).toBe(200);
    expect(response.body.matches[0].resourceId).toBe("computer-science-bs-requirements");
    expect(response.body.groundedAnswer).toMatchObject({ verified: false, sections: [], tables: [] });
    expect(response.body.retrievalStatus).toBe("insufficient_content");
  });

  it("exposes structured parsed FAU content but never raw HTML", async () => {
    const response = await request("POST", "/api/pages/fetch", { url: "https://www.fau.edu/registrar/" });
    expect(response.status).toBe(200);
    expect(response.body.page.sections).toEqual(expect.any(Array));
    expect(response.body.page.text).toMatch(/important deadlines/i);
    expect(response.body.page.html).toBeUndefined();
  });

  it("summarizes a selected result URL without requiring copy and paste", async () => {
    const response = await request("POST", "/api/ai/summarize-resource", {
      url: "https://www.fau.edu/registrar/",
      title: "Registrar",
      query: "official transcript"
    });
    expect(response.status).toBe(200);
    expect(response.body.groundedAnswer).toEqual(expect.objectContaining({ verified: expect.any(Boolean), title: expect.any(String) }));
    expect(response.body.sources[0].url).toBe("https://www.fau.edu/registrar/");
  });

  it("rejects unsafe page-fetch destinations", async () => {
    const response = await request("POST", "/api/pages/fetch", { url: "http://127.0.0.1/private" });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("invalid_fau_url");
  });

  it("answers graduation questions with ranked official pages", async () => {
    const response = await request("POST", "/api/ai/find", { question: "when is graduation?" });

    expect(response.status).toBe(200);
    expect(response.body.answer).toMatch(/graduation/i);
    expect(response.body.matches[0].resourceId).toBe("academic-calendar");
    expect(response.body.matches[0].confidence).toBeGreaterThan(0.8);
  });

  it("answers class registration questions with steps and portal links", async () => {
    const response = await request("POST", "/api/ai/find", { question: "how to register for classes" });

    expect(response.status).toBe(200);
    expect(response.body.answer).toMatch(/1\./);
    expect(response.body.answer).toMatch(/MyFAU/i);
    expect(response.body.answer).toMatch(/Select the term/i);
    expect(response.body.answer).toMatch(/submit/i);
    expect(response.body.answer).toMatch(/Academic Calendar/i);
    expect(response.body.answer).toContain("https://myfau.fau.edu/");
    expect(response.body.answer).toContain("https://www.fau.edu/registrar/registration/calendar/");
    expect(response.body.matches[0].resourceId).toBe("myfau");
  });

  it("references the academic calendar for summer graduation dates", async () => {
    const response = await request("POST", "/api/ai/find", { question: "when is summer graduation?" });

    expect(response.status).toBe(200);
    expect(response.body.answer).toMatch(/Academic Calendar/i);
    expect(response.body.answer).toContain("https://www.fau.edu/registrar/registration/calendar/");
    expect(response.body.matches[0].resourceId).toBe("academic-calendar");
  });

  it("understands common schedule-change synonyms", async () => {
    const response = await request("POST", "/api/ai/find", { question: "I need to leave a course" });

    expect(response.status).toBe(200);
    expect(response.body.matches[0].resourceId).toBe("registration-faqs");
  });

  it("returns an intentional no-match state instead of random resources", async () => {
    const response = await request("POST", "/api/ai/find", { question: "purple elephant orchestra" });

    expect(response.status).toBe(200);
    expect(response.body.matches).toEqual([]);
    expect(response.body.answer).toMatch(/could not find a strong match/i);
  });

  it("returns AI page summary fields", async () => {
    const response = await request("POST", "/api/ai/summarize", {
      url: "https://www.fau.edu/registrar/"
    });

    expect(response.status).toBe(200);
    expect(response.body.summary).toBeTruthy();
    expect(response.body.nextSteps).toBeTruthy();
  });

  it("rejects non-FAU summarize URLs", async () => {
    const response = await request("POST", "/api/ai/summarize", { url: "https://example.com/page" });

    expect(response.status).toBe(400);
  });

  it("rejects malformed summarize URLs as user input errors", async () => {
    const response = await request("POST", "/api/ai/summarize", { url: "not a URL" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/valid public FAU|public FAU/i);
  });

  it("summarizes pasted page text without requiring a URL", async () => {
    const response = await request("POST", "/api/ai/summarize", {
      text: "Students should submit the form before the listed deadline. Contact the Registrar with questions. Keep a copy of the confirmation."
    });

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatch(/submit the form/i);
  });

  it("requires either a URL or enough pasted text", async () => {
    const response = await request("POST", "/api/ai/summarize", { text: "too short" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/at least 20/i);
  });
});
