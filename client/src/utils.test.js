import { describe, expect, it } from "vitest";
import { createPinnedLink, isAllowedFauUrl, parsePinnedLinks, parseSavedLinks, validateSummaryInput } from "./utils.js";

describe("FAU URL validation", () => {
  it("accepts public FAU HTTPS pages and subdomains", () => {
    expect(isAllowedFauUrl("https://www.fau.edu/registrar/")).toBe(true);
    expect(isAllowedFauUrl("https://myfau.fau.edu/")).toBe(true);
  });

  it("rejects non-FAU, insecure, credentialed, and malformed URLs", () => {
    expect(isAllowedFauUrl("https://example.com/")).toBe(false);
    expect(isAllowedFauUrl("http://www.fau.edu/")).toBe(false);
    expect(isAllowedFauUrl("https://user:pass@www.fau.edu/")).toBe(false);
    expect(isAllowedFauUrl("not a url")).toBe(false);
  });

  it("allows pasted text without a URL", () => {
    expect(validateSummaryInput("", "This is enough pasted page text to summarize.")).toBe("");
    expect(validateSummaryInput("", "too short")).toMatch(/at least 20/i);
  });
});

describe("pinned-link persistence", () => {
  it("keeps safe unique pins and preserves custom display names", () => {
    const raw = JSON.stringify([
      { id: "1", url: "https://www.fau.edu/registrar/", originalTitle: "Registrar", displayName: "Registration Info", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", url: "https://www.fau.edu/registrar/", originalTitle: "Duplicate", displayName: "Duplicate" },
      { id: "3", url: "https://example.com/", originalTitle: "Unsafe", displayName: "Unsafe" }
    ]);
    expect(parsePinnedLinks(raw)).toEqual([expect.objectContaining({ displayName: "Registration Info", originalTitle: "Registrar" })]);
  });

  it("recovers from malformed pin storage and creates readable pin names", () => {
    expect(parsePinnedLinks("bad json")).toEqual([]);
    expect(createPinnedLink({ title: "CS B.S. Degree Requirements", url: "https://www.fau.edu/cs/" })).toMatchObject({
      displayName: "CS B.S. Degree Requirements",
      originalTitle: "CS B.S. Degree Requirements",
      url: "https://www.fau.edu/cs/"
    });
  });
});

describe("saved-link persistence", () => {
  it("drops malformed, unsafe, and duplicate saved links", () => {
    const raw = JSON.stringify([
      { id: "1", title: "Registrar", url: "https://www.fau.edu/registrar/", category: "Academics" },
      { id: "2", title: "Duplicate", url: "https://www.fau.edu/registrar/" },
      { id: "3", title: "Unsafe", url: "https://example.com/" },
      { id: "4", url: "https://www.fau.edu/library/" }
    ]);

    expect(parseSavedLinks(raw)).toEqual([
      expect.objectContaining({ id: "1", title: "Registrar", category: "Academics" })
    ]);
  });

  it("recovers safely from invalid storage data", () => {
    expect(parseSavedLinks("not json")).toEqual([]);
    expect(parseSavedLinks(JSON.stringify({ id: "not-an-array" }))).toEqual([]);
  });
});
