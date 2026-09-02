function splitIntoSentences(text) {
  // Very small sentence splitter — keeps punctuation with sentence
  return text
    .replace(/\n+/g, "\n")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“‘])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function chunkText(text, maxChars = 1000, overlap = 200) {
  if (!text || typeof text !== "string") return [];

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return [{ text: normalized }];

  const sentences = splitIntoSentences(normalized);
  const chunks = [];
  let current = "";

  for (const sent of sentences) {
    if ((current + " " + sent).trim().length <= maxChars) {
      current = (current + " " + sent).trim();
      continue;
    }

    // finalize current
    if (current.length > 0) chunks.push(current);

    // if sentence itself is too large, hard-split
    if (sent.length > maxChars) {
      for (let i = 0; i < sent.length; i += maxChars - 20) {
        chunks.push(sent.slice(i, i + (maxChars - 20)).trim());
      }
      current = "";
      continue;
    }

    // start new chunk with sentence
    current = sent;
  }

  if (current.length > 0) chunks.push(current);

  // add overlap by copying last `overlap` characters to next chunk where possible
  if (overlap > 0) {
    const overlapped = [];
    for (let i = 0; i < chunks.length; i++) {
      const base = chunks[i];
      if (i === 0) {
        overlapped.push(base);
        continue;
      }
      const prev = overlapped[overlapped.length - 1];
      const carry = prev.slice(Math.max(0, prev.length - overlap));
      const merged = (carry + " " + base).trim();
      overlapped.push(merged);
    }
    return overlapped.map((t) => ({ text: t }));
  }

  return chunks.map((t) => ({ text: t }));
}

export default { chunkText };
