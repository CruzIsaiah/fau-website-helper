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
});
