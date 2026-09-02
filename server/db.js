import { v4 as uuid } from "uuid";
import { getSupabaseAdminClient, shouldUseSupabase } from "./supabase.js";

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

function toSavedResource(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    url: row.url,
    notes: row.notes || "",
    category: row.category || "General",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listSavedResources(userId) {
  if (shouldUseSupabase()) {
    const { data, error } = await getSupabaseAdminClient()
      .from("saved_resources")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data.map(toSavedResource);
  }

  return [...savedResources.values()]
    .filter((item) => item.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function createSavedResource(userId, resource) {
  if (shouldUseSupabase()) {
    const { data, error } = await getSupabaseAdminClient()
      .from("saved_resources")
      .insert({
        user_id: userId,
        title: resource.title,
        url: resource.url,
        notes: resource.notes || "",
        category: resource.category || "General"
      })
      .select("*")
      .single();

    if (error) throw error;
    return toSavedResource(data);
  }

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

export async function updateSavedResource(userId, id, updates) {
  if (shouldUseSupabase()) {
    const payload = {};
    for (const key of ["title", "url", "notes", "category"]) {
      if (updates[key] !== undefined) payload[key] = updates[key];
    }
    payload.updated_at = new Date().toISOString();

    const { data, error } = await getSupabaseAdminClient()
      .from("saved_resources")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data ? toSavedResource(data) : null;
  }

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

export async function deleteSavedResource(userId, id) {
  if (shouldUseSupabase()) {
    const { data, error } = await getSupabaseAdminClient()
      .from("saved_resources")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  const record = savedResources.get(id);
  if (!record || record.userId !== userId) return false;
  return savedResources.delete(id);
}
