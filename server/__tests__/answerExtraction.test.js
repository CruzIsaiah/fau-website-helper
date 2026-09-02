import { describe, expect, it } from "vitest";
import { extractDateAnswer, NOT_VERIFIED } from "../answerExtraction.js";
import { researchFauQuestion } from "../ai.js";
import { fauResources } from "../resources.js";

const calendarPage = {
  title: "Academic Calendar | Florida Atlantic University",
  url: "https://www.fau.edu/registrar/calendar/",
  canonicalUrl: "https://www.fau.edu/registrar/calendar/",
  links: [],
  sections: [
    {
      heading: "Fall 2026", paragraphs: [], lists: [], definitions: [], links: [],
      tables: [
        {
        heading: "Fall 2026", headers: ["Date", "Event"], rows: [
          ["Aug 22 Sat", "Classes Begin"],
          ["Aug 28 Fri", "Last Day to Drop/Add"],
          ["Oct 30 Fri", "Last Day to Drop with a W"],
          ["Dec 10 Thu", "Final Exams Begin"],
          ["Dec 16 Wed", "Final Exams End"],
          ["Dec 17 Thu", "Commencement"],
          ["Dec 18 Fri", "Commencement"]
        ]
        },
        {
          heading: "Fall 2026", headers: ["Date", "Event"], rows: [
            ["Oct 31 Sat", "Classes Begin"],
            ["Nov 20 Fri", "Last Day to Drop with a W"]
          ]
        }
      ]
    }
  ]
};

describe("calendar answer extraction", () => {
  const cases = [
    ["when is graduation for fall", "Fall 2026 commencement is scheduled for December 17 and 18, 2026."],
    ["when is fall commencement", "Fall 2026 commencement is scheduled for December 17 and 18, 2026."],
    ["when is the last day to drop", "For Fall 2026, the last day to drop a class during drop/add is August 28, 2026."],
    ["when does fall semester start", "Fall 2026 classes begin August 22, 2026."],
    ["when are final exams", "Fall 2026 final exams are scheduled from December 10 through December 16, 2026."]
  ];

  it.each(cases)("answers %s with the exact matching calendar row", (query, expected) => {
    const result = extractDateAnswer(query, [calendarPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result).toMatchObject({ applicable: true, found: true });
    expect(result.groundedAnswer.summary).toBe(expected);
    expect(result.source).toMatchObject({ title: calendarPage.title, url: calendarPage.url });
  });

  it.each(cases)("returns the direct answer first through the RAG pipeline for %s", async (query, expected) => {
    const result = await researchFauQuestion({
      question: query,
      resources: fauResources,
      useIndex: false,
      pageFetcher: async () => calendarPage
    });
    expect(result.retrievalStatus).toBe("verified");
    expect(result.answer).toBe(expected);
    expect(result.groundedAnswer.summary).toBe(expected);
    expect(result.sources[0]).toMatchObject({
      title: calendarPage.title,
      url: calendarPage.canonicalUrl,
      excerpt: expect.stringMatching(/Commencement|Drop|Classes Begin|Final Exams/)
    });
  });

  it("does not invent a date when the relevant row has no date", () => {
    const pageWithoutDate = structuredClone(calendarPage);
    pageWithoutDate.sections[0].tables[0].rows = [["Date to be announced", "Commencement"]];
    pageWithoutDate.sections[0].tables[1].rows = [];
    const result = extractDateAnswer("when is fall commencement", [pageWithoutDate], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result).toMatchObject({ applicable: true, found: false });
    expect(result.groundedAnswer.summary).toBe(NOT_VERIFIED);
  });
});
