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
  it("registers a new user and returns a token", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Isaiah Cruz",
      email: "isaiah@example.com",
      password: "password123"
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("isaiah@example.com");
    expect(response.body.token).toBeTruthy();
  });

  it("rejects invalid login credentials", async () => {
    await register();

    const response = await request(app).post("/api/auth/login").send({
      email: "isaiah@example.com",
      password: "wrong-password"
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/incorrect/i);
  });
});

describe("tasks", () => {
  it("protects task routes", async () => {
    const response = await request(app).get("/api/tasks");

    expect(response.status).toBe(401);
  });

  it("creates, lists, updates, and deletes a task", async () => {
    const token = await register();

    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Finish AI project", priority: "high" });

    expect(created.status).toBe(201);
    expect(created.body.task.title).toBe("Finish AI project");

    const listed = await request(app).get("/api/tasks").set("Authorization", `Bearer ${token}`);
    expect(listed.body.tasks).toHaveLength(1);

    const updated = await request(app)
      .put(`/api/tasks/${created.body.task.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "done" });
    expect(updated.body.task.status).toBe("done");

    const deleted = await request(app)
      .delete(`/api/tasks/${created.body.task.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleted.status).toBe(204);
  });

  it("rejects invalid task input", async () => {
    const token = await register();
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "x", priority: "urgent" });

    expect(response.status).toBe(400);
  });
});

describe("ai endpoints", () => {
  it("returns AI suggestions for a goal", async () => {
    const token = await register();
    const response = await request(app)
      .post("/api/ai/suggestions")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "Study for data structures exam" });

    expect(response.status).toBe(200);
    expect(response.body.suggestions[0].title).toBeTruthy();
  });

  it("returns AI insight fields", async () => {
    const token = await register();
    const response = await request(app)
      .post("/api/ai/insights")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "I have too many assignments and need a plan." });

    expect(response.status).toBe(200);
    expect(response.body.summary).toBeTruthy();
    expect(response.body.nextStep).toBeTruthy();
  });
});
