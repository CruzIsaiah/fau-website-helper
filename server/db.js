import { v4 as uuid } from "uuid";

const users = new Map();
const tasks = new Map();

export function resetDb() {
  users.clear();
  tasks.clear();
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

export function findUserById(id) {
  return users.get(id);
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

export function listTasks(userId) {
  return [...tasks.values()]
    .filter((task) => task.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function createTask(userId, task) {
  const now = new Date().toISOString();
  const record = {
    id: uuid(),
    userId,
    title: task.title,
    description: task.description || "",
    priority: task.priority || "medium",
    status: task.status || "todo",
    dueDate: task.dueDate || "",
    createdAt: now,
    updatedAt: now
  };
  tasks.set(record.id, record);
  return record;
}

export function updateTask(userId, id, updates) {
  const task = tasks.get(id);
  if (!task || task.userId !== userId) return null;
  const next = {
    ...task,
    ...updates,
    id: task.id,
    userId,
    updatedAt: new Date().toISOString()
  };
  tasks.set(id, next);
  return next;
}

export function deleteTask(userId, id) {
  const task = tasks.get(id);
  if (!task || task.userId !== userId) return false;
  return tasks.delete(id);
}
