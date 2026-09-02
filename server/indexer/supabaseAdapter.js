import { getSupabaseAdminClient, isSupabaseConfigured } from "../supabase.js";

export async function upsertEmbeddingRow(tableName = "fau_embeddings", row) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured for vector storage.");
  }
  const client = getSupabaseAdminClient();
  // This is a scaffold. Implementation depends on Supabase vector extension schema.
  // Example table schema: id (text), embedding (vector), metadata (jsonb), created_at
  const { data, error } = await client.from(tableName).upsert(row).select();
  if (error) throw error;
  return data;
}

export async function querySimilar(_tableName = "fau_embeddings", _embedding, _topK = 5) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured for vector query.");
  getSupabaseAdminClient();
  // Scaffold: actual vector similarity depends on DB functions available.
  throw new Error("Supabase adapter querySimilar not implemented — adapt to your Supabase vector schema.");
}

export default { upsertEmbeddingRow, querySimilar };
