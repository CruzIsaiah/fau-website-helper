import { describe, expect, it } from "vitest";
import { classifyAnswerType, isRawScrapedSummary, structureGroundedAnswer } from "../answerStructuring.js";

const csPage = {
  title: "Program Summary | Florida Atlantic University",
  url: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/program-sumary-bscs/",
  canonicalUrl: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/program-sumary-bscs/",
  sections: [
    {
      heading: "Degree Requirements", level: 2,
      paragraphs: [
        "The minimum number of credits required for the Bachelor of Science in Computer Science degree is 120 credits. All courses that count toward the degree must be completed with a grade of C or better.",
        "Transfer student requirements and general admissions information are described elsewhere."
      ], lists: [], definitions: [], tables: [], links: []
    },
    {
      heading: "Program Summary (Requires 120 credits)", level: 2, paragraphs: [], lists: [], definitions: [], links: [],
      tables: [{ heading: "Program Summary", headers: ["Course Title", "Course Number", "Credits"], rows: [["Mathematics", "", "11"], ["Computer Science Core", "", "12"], ["Electives", "", "15"], ["Subtotal", "", "120"]] }]
    },
    {
      heading: "Mathematics", level: 2, paragraphs: [], lists: [], definitions: [], links: [],
      tables: [{ heading: "Mathematics", headers: ["Course Title", "Course Number", "Credits"], rows: [["Calculus with Analytic Geometry 1", "MAC 2311", "4"], ["Calculus with Analytic Geometry 2", "MAC 2312", "4"], ["Matrix Theory", "MAS 2103", "3"], ["Subtotal", "", "11"]] }]
    },
    {
      heading: "Computer Science Core", level: 2, paragraphs: [], lists: [], definitions: [], links: [],
      tables: [{ heading: "Computer Science Core", headers: ["Course Title", "Course Number", "Credits"], rows: [["Programming 2", "COP 3014", "3"], ["Data Structures & Algorithm Analysis", "COP 3530", "3"], ["Computer Operating Systems", "COP 4610", "3"]] }]
    },
    {
      heading: "Electives", level: 2,
      paragraphs: ["All students must take 15 credits of elective courses. Suggested areas of study follow."], lists: [], definitions: [], links: [],
      tables: [{ heading: "Electives", headers: ["Course Title", "Course Number", "Credits"], rows: [["Computer Science Electives", "", "15"]] }]
    },
    {
      heading: "Software Engineering", level: 2, paragraphs: [], lists: [], definitions: [], links: [],
      tables: [{ heading: "Software Engineering", headers: ["Course Title", "Course Number", "Credits"], rows: [["Software Engineering Project", "CEN 4910", "3"], ["Object-Oriented Design and Programming", "COP 4331", "3"]] }]
    }
  ]
};

const calendarPage = {
  title: "Academic Calendar | Florida Atlantic University", url: "https://www.fau.edu/registrar/calendar/", canonicalUrl: "https://www.fau.edu/registrar/calendar/",
  sections: [{ heading: "Fall 2026", paragraphs: [], lists: [], definitions: [], links: [], tables: [{ heading: "Fall 2026", headers: [], rows: [
    ["Aug 22 Sat", "Classes Begin"],
    ["Aug 28 Fri", "Last Day to Drop/Add (In person by 5pm, online by 11:59pm; courses are fee liable after this date; $100 late registration fee after this date.)"],
    ["Sep 7 Mon", "Labor Day (University closed)"],
    ["Oct 30 Fri", "Last Day to Drop with a W"],
    ["Dec 10 Thu", "Final Exams Begin"],
    ["Dec 16 Wed", "Final Exams End"],
    ["Dec 17 Thu", "Commencement"], ["Dec 18 Fri", "Commencement"]
  ] }] }]
};

const withdrawalPage = {
  title: "Frequently Asked Questions | Florida Atlantic University", url: "https://www.fau.edu/registrar/registration/faqs/", canonicalUrl: "https://www.fau.edu/registrar/registration/faqs/",
  sections: [{
    heading: "How do I make schedule adjustments after drop/add ends?", definitions: [], tables: [], links: [],
    paragraphs: ["If you drop a course after drop/add has ended, it is considered a withdrawal and will result in a W on your transcript. You are fee liable after drop/add. Always verify dates on the Academic Calendar."],
    lists: [{ ordered: false, items: ["Log in to your MyFAU account", "FAU Self-Service", "Registration", "Register for Classes", "Input Term", "In the Action box, select Drop via Web with W Grade", "Submit"] }]
  }]
};

const registrationPage = {
  title: "Frequently Asked Questions | Florida Atlantic University", url: "https://www.fau.edu/registrar/registration/faqs/", canonicalUrl: "https://www.fau.edu/registrar/registration/faqs/",
  sections: [{
    heading: "How do I add and drop courses?", definitions: [], tables: [], links: [],
    paragraphs: ["Drop/add is the period in which courses may be added or dropped without incurring a fee and without receiving a W. Refer to the Academic Calendar for each part of term."],
    lists: [{ ordered: false, items: ["Log in to your MyFAU account", "FAU Self-Service", "Registration", "Register for Classes"] }]
  }]
};

const bsPrimary = {
  title: "Degree Requirements BSCS | Florida Atlantic University",
  url: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/degree-requirements-bscs/",
  canonicalUrl: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/degree-requirements-bscs/",
  sections: [{
    heading: "Degree Requirements", level: 2, lists: [], definitions: [], tables: [], links: [],
    paragraphs: ["The minimum number of credits required for the Bachelor of Science in Computer Science degree is 120 credits. All required courses must be completed with a grade of C or better."]
  }]
};

const baPrimary = {
  title: "Course Description | Florida Atlantic University",
  url: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science-ba/coursedesc/",
  canonicalUrl: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science-ba/coursedesc/",
  sections: [{
    heading: "Computer Science Core", level: 2, lists: [], definitions: [], links: [],
    paragraphs: ["The Bachelor of Arts in Computer Science requires 120 credits and a grade of C or better in required coursework."],
    tables: [{ heading: "Computer Science Core", headers: ["Course Title", "Course Number", "Credits"], rows: [["Introduction to Programming", "COP 1034C", "3"], ["Data Structures", "COP 3530", "3"]] }]
  }]
};

describe("query-aware answer structuring", () => {
  it("classifies presentation shapes without exposing them in answer copy", () => {
    expect(classifyAnswerType("cs flowchart classes")).toBe("table");
    expect(classifyAnswerType("how do I withdraw from a class")).toBe("steps");
    expect(classifyAnswerType("how many credits is the CS degree")).toBe("short_fact");
  });

  it("returns a clean course table for cs flowchart classes", () => {
    const result = structureGroundedAnswer("cs flowchart classes", [csPage]);
    expect(result.groundedAnswer).toMatchObject({ type: "table", verified: true });
    expect(result.groundedAnswer.tables.flatMap((table) => table.rows)).toContainEqual(["COP 3014", "Programming 2", "3"]);
    expect(result.groundedAnswer.summary).not.toMatch(/Course Title\s*\||transfer|admissions/i);
    expect(isRawScrapedSummary(result.groundedAnswer.summary)).toBe(false);
    expect(result.sources[0].url).toMatch(/program-sumary-bscs/);
  });

  it("anchors a B.S. degree-requirements answer and excludes B.A. courses", () => {
    const selected = { url: bsPrimary.url, title: "Computer Science B.S. Degree Requirements", program: "Computer Science", degree: "B.S." };
    const result = structureGroundedAnswer("CS degree requirements", [baPrimary, csPage, bsPrimary], { primaryResource: selected });
    const courses = result.groundedAnswer.tables.flatMap((table) => table.courses || []);

    expect(result.groundedAnswer.title).toBe(selected.title);
    expect(result.sources[0]).toMatchObject({ title: selected.title, url: selected.url });
    expect(courses).toContainEqual(expect.objectContaining({ code: "COP 3014", title: "Programming 2", credits: "3", sourceUrl: csPage.url, sourceTitle: csPage.title }));
    expect(courses.some((course) => course.code === "COP 1034C")).toBe(false);
    expect(result.groundedAnswer.tables[0].headers).toEqual(["Course", "Title", "Credits"]);
  });

  it("anchors a B.A. answer and never replaces it with B.S. requirements", () => {
    const selected = { url: baPrimary.url, title: "Computer Science B.A. Degree Requirements", program: "Computer Science", degree: "B.A." };
    const result = structureGroundedAnswer("CS degree requirements", [csPage, baPrimary], { primaryResource: selected });
    const courses = result.groundedAnswer.tables.flatMap((table) => table.courses || []);

    expect(result.groundedAnswer.title).toBe(selected.title);
    expect(result.sources[0]).toMatchObject({ title: selected.title, url: selected.url });
    expect(courses.map((course) => course.code)).toEqual(["COP 1034C", "COP 3530"]);
    expect(courses.some((course) => course.code === "COP 3014")).toBe(false);
  });

  it("keeps a selected flowchart as the named source and deduplicates course codes", () => {
    const flowchart = {
      ...csPage,
      title: "B.S. in Computer Science Flowchart (PDF)",
      url: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/flowchart/",
      canonicalUrl: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/flowchart/",
      sections: csPage.sections.map((section) => section.heading === "Computer Science Core" ? {
        ...section,
        tables: [{ ...section.tables[0], rows: [...section.tables[0].rows, ["Programming 2", "COP 3014", "3"]] }]
      } : section)
    };
    const selected = { url: flowchart.url, title: flowchart.title, program: "Computer Science", degree: "B.S." };
    const result = structureGroundedAnswer("summarize this CS flowchart", [flowchart], { primaryResource: selected });
    const courses = result.groundedAnswer.tables.flatMap((table) => table.courses || []);

    expect(result.groundedAnswer.title).toBe(flowchart.title);
    expect(result.sources[0]).toMatchObject({ title: flowchart.title, url: flowchart.url });
    expect(courses.filter((course) => course.code === "COP 3014")).toHaveLength(1);
  });

  it("returns only grouped CS electives", () => {
    const result = structureGroundedAnswer("what are the CS electives", [csPage]);
    expect(result.groundedAnswer.title).toMatch(/Electives/);
    expect(result.groundedAnswer.summary).toMatch(/15 credits/);
    expect(result.groundedAnswer.tables.map((table) => table.heading)).toEqual(["Software Engineering"]);
    expect(JSON.stringify(result.groundedAnswer)).not.toMatch(/Calculus|Transfer student/);
  });

  it("returns only the required CS math courses", () => {
    const result = structureGroundedAnswer("what math classes are required for CS", [csPage]);
    expect(result.groundedAnswer.tables).toHaveLength(1);
    expect(result.groundedAnswer.tables[0].rows).toEqual([
      ["MAC 2311", "Calculus with Analytic Geometry 1", "4"],
      ["MAC 2312", "Calculus with Analytic Geometry 2", "4"],
      ["MAS 2103", "Matrix Theory", "3"]
    ]);
    expect(JSON.stringify(result.groundedAnswer)).not.toMatch(/Programming|Elective/);
  });

  it("puts the exact graduation date first without calendar dumping", () => {
    const result = structureGroundedAnswer("when is graduation for fall", [calendarPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result.groundedAnswer).toMatchObject({ type: "date", summary: "Fall 2026 commencement is scheduled for December 17 and 18, 2026." });
    expect(result.groundedAnswer.tables).toEqual([]);
  });

  it("returns numbered withdrawal steps instead of a deadline", () => {
    const result = structureGroundedAnswer("how do I withdraw from a class", [withdrawalPage]);
    expect(result.groundedAnswer.type).toBe("steps");
    expect(result.groundedAnswer.steps).toHaveLength(7);
    expect(result.groundedAnswer.steps.at(-2)).toMatch(/Drop via Web with W Grade/);
    expect(result.groundedAnswer.summary).not.toMatch(/October|deadline/i);
  });

  it("answers the CS credit question with one direct sentence", () => {
    const result = structureGroundedAnswer("how many credits is the CS degree", [csPage]);
    expect(result.groundedAnswer).toMatchObject({
      type: "short_fact",
      summary: "The FAU Computer Science B.S. requires at least 120 credits."
    });
    expect(result.sources[0].url).toMatch(/program-sumary-bscs/);
  });

  it("returns a broad important-date overview only for an academic calendar query", () => {
    const result = structureGroundedAnswer("academic calendar", [calendarPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result.groundedAnswer.type).toBe("date");
    expect(result.groundedAnswer.facts.map((fact) => fact.label)).toEqual([
      "Classes begin", "Add/drop deadline", "Labor Day", "Withdrawal deadline", "Final exams", "Commencement"
    ]);
  });

  it("returns only add/drop dates and supported notes for add/drop", () => {
    const result = structureGroundedAnswer("add/drop", [calendarPage, registrationPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result.groundedAnswer.title).toBe("Fall 2026 Add / Drop");
    expect(result.groundedAnswer.facts).toEqual([
      { label: "Add deadline", value: "August 28, 2026" },
      { label: "Drop deadline", value: "August 28, 2026" }
    ]);
    expect(JSON.stringify(result.groundedAnswer)).not.toMatch(/Commencement|Final Exams|Labor Day/);
    expect(result.sources.map((source) => source.title)).toEqual([calendarPage.title, registrationPage.title]);
  });

  it("extracts the last day to add from the shared calendar source", () => {
    const result = structureGroundedAnswer("when is the last day to add a class", [calendarPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result.groundedAnswer.summary).toBe("For Fall 2026, the last day to add a class is August 28, 2026.");
    expect(JSON.stringify(result.groundedAnswer)).not.toMatch(/October 30|December/);
  });

  it("treats the last day to drop as the drop/add date", () => {
    const result = structureGroundedAnswer("last day to drop", [calendarPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result.groundedAnswer.summary).toBe("For Fall 2026, the last day to drop a class during drop/add is August 28, 2026.");
  });

  it("keeps the withdrawal deadline separate from drop/add", () => {
    const result = structureGroundedAnswer("withdrawal deadline", [calendarPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result.groundedAnswer.summary).toBe("The Fall 2026 withdrawal deadline is October 30, 2026.");
    expect(JSON.stringify(result.groundedAnswer)).not.toMatch(/August 28/);
  });

  it("returns only final exam dates for when are finals", () => {
    const result = structureGroundedAnswer("when are finals", [calendarPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result.groundedAnswer.summary).toBe("Fall 2026 final exams are scheduled from December 10 through December 16, 2026.");
    expect(JSON.stringify(result.groundedAnswer)).not.toMatch(/Commencement|August 28/);
  });

  it("uses the current term for a graduation query without an explicit term", () => {
    const result = structureGroundedAnswer("when is graduation", [calendarPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result.groundedAnswer.summary).toBe("Fall 2026 commencement is scheduled for December 17 and 18, 2026.");
    expect(JSON.stringify(result.groundedAnswer)).not.toMatch(/Final Exams|August/);
  });

  it("uses registration steps first and the calendar only as deadline support for adding a class", () => {
    const result = structureGroundedAnswer("how do I add a class", [registrationPage, calendarPage], { now: new Date("2026-09-02T12:00:00Z") });
    expect(result.groundedAnswer.type).toBe("steps");
    expect(result.groundedAnswer.steps).toEqual(["Log in to your MyFAU account", "FAU Self-Service", "Registration", "Register for Classes"]);
    expect(result.groundedAnswer.facts).toEqual([{ label: "Add/drop deadline", value: "August 28, 2026" }]);
    expect(result.sources[0].title).toBe(registrationPage.title);
    expect(result.sources[1].title).toBe(calendarPage.title);
  });
});
