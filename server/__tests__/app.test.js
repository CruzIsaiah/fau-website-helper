import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { resetDb } from "../db.js";

const app = createApp();

async function register() {
  const response = await request(app).post("/api/auth/register").send({
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
    const response = await request(app).post("/api/auth/register").send({
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

    const response = await request(app).post("/api/auth/login").send({
      email: "isaiah@example.com",
      password: "wrong-password"
    });

    expect(response.status).toBe(401);
  });
});

describe("resources", () => {
  it("lists curated FAU resources", async () => {
    const response = await request(app).get("/api/resources");

    expect(response.status).toBe(200);
    expect(response.body.resources.length).toBeGreaterThan(5);
  });

  it("protects saved resources", async () => {
    const response = await request(app).get("/api/saved");

    expect(response.status).toBe(401);
  });

  it("creates, lists, updates, and deletes a saved resource", async () => {
    const token = await register();

    const created = await request(app)
      .post("/api/saved")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Registrar",
        url: "https://www.fau.edu/registrar/",
        category: "Academics",
        notes: "Registration and transcripts"
      });

    expect(created.status).toBe(201);
    expect(created.body.saved.title).toBe("Registrar");

    const listed = await request(app).get("/api/saved").set("Authorization", `Bearer ${token}`);
    expect(listed.body.saved).toHaveLength(1);

    const updated = await request(app)
      .put(`/api/saved/${created.body.saved.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "Updated notes" });
    expect(updated.body.saved.notes).toBe("Updated notes");

    const deleted = await request(app)
      .delete(`/api/saved/${created.body.saved.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleted.status).toBe(204);
  });

  it("rejects invalid saved resource input", async () => {
    const token = await register();
    const response = await request(app)
      .post("/api/saved")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "x", url: "not-a-url" });

    expect(response.status).toBe(400);
  });
});

describe("ai endpoints", () => {
  it("returns AI resource matches", async () => {
    const token = await register();
    const response = await request(app)
      .post("/api/ai/find")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Where do I pay tuition?" });

    expect(response.status).toBe(200);
    expect(response.body.matches[0].resourceId).toBeTruthy();
  });

  it("returns AI page summary fields", async () => {
    const token = await register();
    const response = await request(app)
      .post("/api/ai/summarize")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "FAU page",
        url: "https://www.fau.edu/registrar/",
        text: "Students should review deadlines, submit required forms, and contact the listed office for help."
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toBeTruthy();
    expect(response.body.nextSteps).toBeTruthy();
  });
});
