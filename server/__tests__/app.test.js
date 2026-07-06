import { Readable, Writable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { resetDb } from "../db.js";

const app = createApp();

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = Readable.from(payload ? [payload] : []);
    const headers = {
      host: "localhost",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload)
    };

    if (token) headers.authorization = `Bearer ${token}`;

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

async function register() {
  const response = await request("POST", "/api/auth/register", {
    name: "Isaiah Cruz",
    email: "isaiah@example.com",
    password: "password123"
  });
  return response.body.token;
}

beforeEach(() => {
  resetDb();
});

describe("auth", () => {
  it("registers a new user", async () => {
    const response = await request("POST", "/api/auth/register", {
      name: "Isaiah Cruz",
      email: "isaiah@example.com",
      password: "password123"
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("isaiah@example.com");
    expect(response.body.token).toBeTruthy();
  });

  it("rejects invalid login", async () => {
    await register();

    const response = await request("POST", "/api/auth/login", {
      email: "isaiah@example.com",
      password: "wrong-password"
    });

    expect(response.status).toBe(401);
  });
});

describe("resources", () => {
  it("lists curated FAU resources", async () => {
    const response = await request("GET", "/api/resources");

    expect(response.status).toBe(200);
    expect(response.body.resources.length).toBeGreaterThan(5);
  });

  it("protects saved resources", async () => {
    const response = await request("GET", "/api/saved");

    expect(response.status).toBe(401);
  });

  it("creates, lists, updates, and deletes a saved resource", async () => {
    const token = await register();

    const created = await request("POST", "/api/saved", {
      title: "Registrar",
      url: "https://www.fau.edu/registrar/",
      category: "Academics",
      notes: "Registration and transcripts"
    }, token);

    expect(created.status).toBe(201);
    expect(created.body.saved.title).toBe("Registrar");

    const listed = await request("GET", "/api/saved", undefined, token);
    expect(listed.body.saved).toHaveLength(1);

    const updated = await request("PUT", `/api/saved/${created.body.saved.id}`, { notes: "Updated notes" }, token);
    expect(updated.body.saved.notes).toBe("Updated notes");

    const deleted = await request("DELETE", `/api/saved/${created.body.saved.id}`, undefined, token);
    expect(deleted.status).toBe(204);
  });

  it("rejects invalid saved resource input", async () => {
    const token = await register();
    const response = await request("POST", "/api/saved", { title: "x", url: "not-a-url" }, token);

    expect(response.status).toBe(400);
  });
});

describe("ai endpoints", () => {
  it("returns AI resource matches", async () => {
    const token = await register();
    const response = await request("POST", "/api/ai/find", { question: "Where do I pay tuition?" }, token);

    expect(response.status).toBe(200);
    expect(response.body.matches[0].resourceId).toBeTruthy();
  });

  it("answers graduation questions with ranked official pages", async () => {
    const token = await register();
    const response = await request("POST", "/api/ai/find", { question: "when is graduation?" }, token);

    expect(response.status).toBe(200);
    expect(response.body.answer).toMatch(/graduation/i);
    expect(response.body.matches[0].resourceId).toBe("academic-calendar");
    expect(response.body.matches[0].confidence).toBeGreaterThan(0.8);
  });

  it("answers class registration questions with steps and portal links", async () => {
    const token = await register();
    const response = await request("POST", "/api/ai/find", { question: "how to register for classes" }, token);

    expect(response.status).toBe(200);
    expect(response.body.answer).toMatch(/1\./);
    expect(response.body.answer).toMatch(/MyFAU/i);
    expect(response.body.answer).toMatch(/Academic Calendar/i);
    expect(response.body.matches[0].resourceId).toBe("myfau");
  });

  it("references the academic calendar for summer graduation dates", async () => {
    const token = await register();
    const response = await request("POST", "/api/ai/find", { question: "when is summer graduation?" }, token);

    expect(response.status).toBe(200);
    expect(response.body.answer).toMatch(/Academic Calendar/i);
    expect(response.body.matches[0].resourceId).toBe("academic-calendar");
  });

  it("returns AI page summary fields", async () => {
    const token = await register();
    const response = await request("POST", "/api/ai/summarize", {
      url: "https://www.fau.edu/registrar/"
    }, token);

    expect(response.status).toBe(200);
    expect(response.body.summary).toBeTruthy();
    expect(response.body.nextSteps).toBeTruthy();
  });

  it("rejects non-FAU summarize URLs", async () => {
    const token = await register();
    const response = await request("POST", "/api/ai/summarize", { url: "https://example.com/page" }, token);

    expect(response.status).toBe(400);
  });
});
