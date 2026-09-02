const FAU_HOST_PATTERN = /(^|\.)fau\.edu$/i;

export function isAllowedFauUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      FAU_HOST_PATTERN.test(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port;
  } catch {
    return false;
  }
}

export function validateSummaryInput(url, text) {
  if (!url && text.trim().length < 20) {
    return "Enter a public FAU page URL or paste at least 20 characters of page text.";
  }
  if (url && !isAllowedFauUrl(url)) {
    return "Enter a public FAU HTTPS URL, such as https://www.fau.edu/registrar/.";
  }
  return "";
}

export function parseSavedLinks(rawValue) {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    return parsed.filter((item) => {
      const valid = item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        item.title.trim() &&
        typeof item.url === "string" &&
        isAllowedFauUrl(item.url) &&
        !seen.has(item.url);
      if (valid) seen.add(item.url);
      return Boolean(valid);
    }).map((item) => ({
      id: item.id,
      title: item.title.trim(),
      url: item.url,
      category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : "FAU resource",
      notes: typeof item.notes === "string" ? item.notes : ""
    }));
  } catch {
    return [];
  }
}

export function createSavedItem(resource, reason = "") {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: resource.title,
    url: resource.url,
    category: resource.category || "FAU resource",
    notes: reason || resource.description || ""
  };
}

export function parsePinnedLinks(rawValue) {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    return parsed.filter((item) => {
      const valid = item && typeof item.id === "string" && typeof item.originalTitle === "string" &&
        typeof item.displayName === "string" && item.displayName.trim() && typeof item.url === "string" &&
        isAllowedFauUrl(item.url) && !seen.has(item.url);
      if (valid) seen.add(item.url);
      return Boolean(valid);
    }).map((item) => ({
      id: item.id,
      url: item.url,
      originalTitle: item.originalTitle.trim(),
      displayName: item.displayName.trim().slice(0, 80),
      description: typeof item.description === "string" ? item.description : "",
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString()
    }));
  } catch {
    return [];
  }
}

export function createPinnedLink(resource) {
  const title = String(resource.title || resource.description || "FAU resource").trim().slice(0, 80);
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    url: resource.url,
    originalTitle: title,
    displayName: title,
    description: resource.description || "",
    createdAt: new Date().toISOString()
  };
}
