import { v4 as uuid } from "uuid";

const users = new Map();
const savedResources = new Map();

export function resetDb() {
  users.clear();
  savedResources.clear();
}

export function createUser(user) {
  const now = new Date().toISOString();
  const record = { id: uuid(), createdAt: now, ...user };
  users.set(record.id, record);
  return record;
}

export function findUserByEmail(email) {
  return [...users.values()].find((user) => user.email === email.toLowerCase());
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

export function listSavedResources(userId) {
  return [...savedResources.values()]
    .filter((item) => item.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function createSavedResource(userId, resource) {
  const now = new Date().toISOString();
  const record = {
    id: uuid(),
    userId,
    title: resource.title,
    url: resource.url,
    notes: resource.notes || "",
    category: resource.category || "General",
    createdAt: now,
    updatedAt: now
  };
  savedResources.set(record.id, record);
  return record;
}

export function updateSavedResource(userId, id, updates) {
  const record = savedResources.get(id);
  if (!record || record.userId !== userId) return null;
  const next = {
    ...record,
    ...updates,
    id: record.id,
    userId,
    updatedAt: new Date().toISOString()
  };
  savedResources.set(id, next);
  return next;
}

export function deleteSavedResource(userId, id) {
  const record = savedResources.get(id);
  if (!record || record.userId !== userId) return false;
  return savedResources.delete(id);
}
