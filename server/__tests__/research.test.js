import { describe, expect, it, vi } from "vitest";
import { researchFauQuestion } from "../ai.js";
import { rankPageChunks, rankPageLinks, retrieveFauContent } from "../research.js";
import { fauResources } from "../resources.js";

function page({ url, title = "Computer Science B.S. Requirements", links = [], sections }) {
  return {
    title, url, canonicalUrl: url, httpStatus: 200, cache: "miss", links,
    sections: sections || [{
      heading: "Degree Requirements", level: 2,
      paragraphs: ["The Computer Science B.S. includes required coursework and approved electives."],
      lists: [{ ordered: false, items: ["Complete the required Computer Science core.", "Select approved upper-division electives."] }],
      definitions: [],
      tables: [{ heading: "Required Courses", headers: ["Course", "Credits"], rows: [["COP 3000", "3"]] }],
      links: []
    }]
  };
}

describe("retrieved FAU content", () => {
  it("ranks requirement sections, tables, and contextual links", () => {
    const source = page({
      url: "https://www.fau.edu/engineering/cs/",
      links: [
        { text: "B.S. Degree Requirements", href: "https://www.fau.edu/engineering/cs/requirements/", surroundingContext: "Computer Science curriculum", sectionHeading: "Computer Science B.S." },
        { text: "Give to FAU", href: "https://www.fau.edu/give/", surroundingContext: "Support FAU", sectionHeading: "Footer" }
      ]
    });
    const chunks = rankPageChunks("CS degree requirements", [source]);
    const links = rankPageLinks("CS degree requirements", [source]);
    expect(chunks[0]).toMatchObject({ sectionHeading: "Degree Requirements", tables: [expect.objectContaining({ headers: ["Course", "Credits"] })] });
    expect(links[0].text).toBe("B.S. Degree Requirements");
    expect(links.some((link) => link.text === "Give to FAU")).toBe(false);
  });

  it("performs only bounded one-hop discovery and deduplicates URLs", async () => {
    const firstUrl = fauResources.find((resource) => resource.id === "computer-science-bs-requirements").url;
    const discoveredUrl = "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/curriculum/";
    const pageFetcher = vi.fn(async (url) => page({
      url,
      links: url === firstUrl ? [
        { text: "Computer Science B.S. curriculum and degree requirements", href: discoveredUrl, surroundingContext: "Required courses and curriculum", sectionHeading: "Degree Requirements" },
        { text: "Duplicate curriculum", href: discoveredUrl, surroundingContext: "Computer Science requirements", sectionHeading: "Degree Requirements" }
      ] : []
    }));
    const result = await retrieveFauContent({
      question: "CS degree requirements",
      matches: [{ resourceId: "computer-science-bs-requirements" }, { resourceId: "computer-science-ba-requirements" }],
      resources: fauResources,
      pageFetcher,
      maxInitialPages: 2,
      maxFollowPages: 3
    });
    expect(pageFetcher).toHaveBeenCalledTimes(3);
    expect(pageFetcher.mock.calls.filter(([url]) => url === discoveredUrl)).toHaveLength(1);
    expect(result.debug.discoveryLinks).toHaveLength(1);
  });

  it("follows only same-degree support links for an explicitly selected B.S. result", async () => {
    const selected = fauResources.find((resource) => resource.id === "computer-science-bs-requirements");
    const bsSupportUrl = "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/program-sumary-bscs/";
    const baSupportUrl = "https://www.fau.edu/engineering/eecs/undergraduate/computer-science-ba/coursedesc/";
    const pageFetcher = vi.fn(async (url) => page({
      url,
      links: url === selected.url ? [
        { text: "B.S. program summary and required courses", href: bsSupportUrl, surroundingContext: "Bachelor of Science curriculum", sectionHeading: "Degree Requirements" },
        { text: "Computer Science B.A. required courses", href: baSupportUrl, surroundingContext: "Bachelor of Arts curriculum", sectionHeading: "Degree Requirements" }
      ] : []
    }));

    const result = await retrieveFauContent({
      question: "CS degree requirements",
      matches: [{ resourceId: selected.id }, { resourceId: "computer-science-ba-requirements" }],
      resources: fauResources,
      anchorResource: selected,
      pageFetcher,
      maxInitialPages: 2,
      maxFollowPages: 3
    });

    expect(pageFetcher.mock.calls.map(([url]) => url)).toEqual([selected.url, bsSupportUrl]);
    expect(result.debug.discoveryLinks).toHaveLength(1);
    expect(result.debug.discoveryLinks[0].href).toBe(bsSupportUrl);
  });

  it("returns verified structured content and exact source excerpts", async () => {
    const pageFetcher = vi.fn(async (url) => page({ url }));
    const result = await researchFauQuestion({ question: "CS degree requirements", resources: fauResources, useIndex: false, pageFetcher });
    expect(result.retrievalStatus).toBe("verified");
    expect(result.groundedAnswer).toMatchObject({
      verified: true,
      sections: [expect.objectContaining({ heading: "Degree Requirements" })],
      tables: [expect.objectContaining({ headers: ["Course", "Credits"] })]
    });
    expect(result.sources[0]).toMatchObject({ sectionHeading: "Degree Requirements", excerpt: expect.stringMatching(/required coursework/i) });
  });

  it("keeps official metadata when every page fetch fails", async () => {
    const result = await researchFauQuestion({
      question: "CS degree requirements",
      resources: fauResources,
      useIndex: false,
      pageFetcher: vi.fn().mockRejectedValue(new Error("blocked"))
    });
    expect(result.retrievalStatus).toBe("source_unavailable");
    expect(result.groundedAnswer.verified).toBe(false);
    expect(result.matches[0].resourceId).toBe("computer-science-bs-requirements");
    expect(result.sources[0].url).toMatch(/fau\.edu/);
  });
});
