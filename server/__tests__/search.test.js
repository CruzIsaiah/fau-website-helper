import { describe, expect, it, vi } from "vitest";
import { fauResources } from "../resources.js";
import { analyzeQuery, rankFauResources } from "../search.js";

const cases = [
  ["CS degree requirements", "computer-science-bs-requirements"],
  ["computer science degree requirements", "computer-science-bs-requirements"],
  ["classes for computer science", "computer-science-bs-requirements"],
  ["CS curriculum", "computer-science-bs-requirements"],
  ["what classes do i need for CS", "computer-science-bs-requirements"],
  ["computer science major", "computer-science-bs-requirements"],
  ["computor science requirements", "computer-science-bs-requirements"],
  ["financial aid", "financial-aid"],
  ["where is my fafsa", "financial-aid"],
  ["why didn't i get financial aid", "financial-aid"],
  ["finacial aid", "financial-aid"],
  ["drop class", "registration-faqs"],
  ["withdraw from course", "registration-faqs"],
  ["how do i leave a class", "registration-faqs"],
  ["how do I add a class", "registration-faqs"],
  ["pay tuition", "controller"],
  ["where is my bill", "controller"],
  ["student account", "controller"],
  ["transcript", "registrar"],
  ["send my transcript", "registrar"],
  ["official transcript", "registrar"],
  ["academic calendar", "academic-calendar"],
  ["when does fall semester start", "academic-calendar"],
  ["last day to drop", "academic-calendar"],
  ["AI masters requirements", "artificial-intelligence-ms-requirements"],
  ["biology major requirements", "biology-bs"],
  ["business degree classes", "business-majors"]
];

describe("FAU hybrid search", () => {
  it.each(cases)("ranks the correct official source for %s", (query, expected) => {
    const result = rankFauResources(query, fauResources);
    expect(result.matches[0]?.resourceId).toBe(expected);
  });

  it("normalizes abbreviations and detects multiple intents", () => {
    const analysis = analyzeQuery("  What classes do I need for CS?!  ");
    expect(analysis.normalizedQuery).toBe("what classes do i need for cs");
    expect(analysis.matchedConcepts).toContain("computer science");
    expect(analysis.intents).toContain("courses");
  });

  it("offers only real indexed programs when a query is ambiguous", () => {
    const result = rankFauResources("CS requirements", fauResources);
    expect(result.clarification?.prompt).toMatch(/which program/i);
    expect(result.clarification.options.map((option) => option.label)).toEqual(expect.arrayContaining([
      "Computer Science B.S.",
      "Computer Science B.A."
    ]));
  });

  it("does not manufacture a confident result for unrelated text", () => {
    const result = rankFauResources("purple elephant orchestra", fauResources);
    expect(result.confidenceLevel).toBe("low");
    expect(result.matches).toEqual([]);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("makes development score components inspectable", () => {
    const log = vi.spyOn(console, "debug").mockImplementation(() => {});
    const result = rankFauResources("CS degree requirements", fauResources, { debug: true });
    expect(result.matches[0].scoreBreakdown).toMatchObject({ title: expect.any(Number), program: expect.any(Number), authority: expect.any(Number) });
    expect(log).toHaveBeenCalledWith("[search-debug]", expect.stringContaining("normalizedQuery"));
    log.mockRestore();
  });
});
