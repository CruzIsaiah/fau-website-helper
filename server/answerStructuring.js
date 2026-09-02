import { extractDateAnswer } from "./answerExtraction.js";

const COURSE_CODE = /\b[A-Z]{3}\s*\d{4}[A-Z]?\b/g;
const COURSE_CODE_TEST = /\b[A-Z]{3}\s*\d{4}[A-Z]?\b/;
const RAW_TABLE_TEXT = /\bCourse Title\s*\|\s*Course Number\s*\|\s*Credits\b/i;

function normalize(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function lower(value = "") {
  return normalize(value).toLowerCase();
}

export function classifyAnswerType(question) {
  const query = lower(question);
  if (/\bwhen\b|\bwhat date\b|\bdeadline\b|\blast day\b|\bcommencement\b|\bsemester start\b|\bclasses? (?:start|begin)/.test(query)) return "date";
  if (/\bhow (?:do|can|should)\b|\bsteps?\b|\bprocedure\b/.test(query)) return "steps";
  if (/\bhow many\b|\bhow much\b|\bminimum number\b|\btotal credits?\b/.test(query)) return "short_fact";
  if (/\bwhere\b|\blocation\b|\bbuilding\b|\bcampus\b|\boffice\b/.test(query)) return "location";
  if (/\bcontact\b|\bphone\b|\bemail\b|\bwho (?:do|should|can) i (?:call|email|contact)\b/.test(query)) return "contact";
  if (/\bcompare\b|\bdifference between\b|\bversus\b|\bvs\.?\b/.test(query)) return "comparison";
  if (/\brequirements?\b|\bneed to graduate\b/.test(query)) return "requirements";
  if (/\bcourses?\b|\bclasses\b|\belectives?\b|\bflowchart\b/.test(query)) return "table";
  if (/\blist\b|\bwhat are\b/.test(query)) return "list";
  return "summary";
}

function sourceFor(page, section, excerpt = "") {
  return {
    title: page.title,
    url: page.canonicalUrl || page.url,
    sectionHeading: section?.heading || "",
    excerpt: normalize(excerpt).slice(0, 420)
  };
}

function calendarDate(value, year) {
  const months = { jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June", jul: "July", aug: "August", sep: "September", sept: "September", oct: "October", nov: "November", dec: "December" };
  const match = normalize(value).match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})\b/i);
  if (!match) return null;
  return `${months[match[1].toLowerCase()]} ${Number(match[2])}${year ? `, ${year}` : ""}`;
}

function compactDateRange(start, end, year) {
  const first = start?.match(/^([A-Za-z]+) (\d{1,2})/);
  const last = end?.match(/^([A-Za-z]+) (\d{1,2})/);
  if (!first || !last) return [start, end].filter(Boolean).join("–");
  return first[1] === last[1]
    ? `${first[1]} ${first[2]}–${last[2]}, ${year}`
    : `${first[1]} ${first[2]}–${last[1]} ${last[2]}, ${year}`;
}

function selectedCalendarSection(question, pages, now = new Date()) {
  const query = lower(question);
  const requestedTerm = query.match(/\b(fall|spring|summer)\b/)?.[1] || (now.getMonth() + 1 <= 4 ? "spring" : now.getMonth() + 1 <= 7 ? "summer" : "fall");
  const requestedYear = query.match(/\b(20\d{2})\b/)?.[1] || String(now.getFullYear());
  for (const page of pages || []) {
    if (!/calendar/i.test(`${page.title} ${page.url}`)) continue;
    const exact = (page.sections || []).find((section) => lower(section.heading).includes(`${requestedTerm} ${requestedYear}`));
    const termOnly = (page.sections || []).find((section) => lower(section.heading).includes(requestedTerm));
    const section = exact || termOnly;
    if (section?.tables?.length) return { page, section, term: requestedTerm, year: section.heading.match(/20\d{2}/)?.[0] || requestedYear };
  }
  return null;
}

function broadCalendarAnswer(question, pages, options = {}) {
  if (!/^\s*(?:the\s+)?academic calendar(?:\s+overview)?\s*$/i.test(question)) return null;
  const selected = selectedCalendarSection(question, pages, options.now);
  if (!selected) return null;
  const rows = selected.section.tables[0].rows || [];
  const findRows = (pattern) => rows.filter((row) => pattern.test(row.join(" ")));
  const fact = (label, pattern) => {
    const row = findRows(pattern)[0];
    const value = row ? calendarDate(row[0], selected.year) : null;
    return value ? { label, value, row } : null;
  };
  const holidayRow = findRows(/\b(?:Labor Day|M\.L\. King|Memorial Day)\b/i)[0];
  const holidayDate = holidayRow ? calendarDate(holidayRow[0], selected.year) : null;
  const facts = [
    fact("Classes begin", /\bClasses Begin\b/i),
    fact("Add/drop deadline", /\bLast Day to (?:Drop\/Add|Add\/Drop)\b/i),
    holidayDate ? { label: normalize(holidayRow[1]).replace(/\s*\([^)]*\).*$/, ""), value: holidayDate, row: holidayRow } : null,
    fact("Withdrawal deadline", /\bLast Day to Drop with a ["“]?W/i)
  ].filter(Boolean);
  const finalStart = fact("Final exams begin", /\bFinal Exams Begin\b/i);
  const finalEnd = fact("Final exams end", /\bFinal Exams End\b/i);
  if (finalStart && finalEnd) facts.push({ label: "Final exams", value: compactDateRange(finalStart.value, finalEnd.value, selected.year), row: [...finalStart.row, ...finalEnd.row] });
  const commencementRows = findRows(/\bCommencement\b/i);
  const commencementDates = [...new Set(commencementRows.map((row) => calendarDate(row[0], selected.year)).filter(Boolean))];
  if (commencementDates.length) facts.push({ label: "Commencement", value: commencementDates.length === 2 ? compactDateRange(commencementDates[0], commencementDates[1], selected.year) : commencementDates.join(", "), row: commencementRows.flat() });
  if (!facts.length) return null;
  const term = `${selected.term[0].toUpperCase()}${selected.term.slice(1)} ${selected.year}`;
  return {
    applicable: true, found: true,
    sources: [sourceFor(selected.page, selected.section, facts.flatMap((item) => item.row).join(" | "))],
    groundedAnswer: {
      verified: true, type: "date", title: `${term} Academic Calendar`,
      summary: `Here are the main full-term dates for ${term}.`,
      facts: facts.map(({ row: _row, ...item }) => item), sections: [], tables: [], steps: [], nextSteps: []
    }
  };
}

function degreeKind(value = "") {
  const degree = lower(value);
  if (/\bb\.?s\.?\b|bachelor of science|bscs/.test(degree)) return "bs";
  if (/\bb\.?a\.?\b|bachelor of arts|bacs/.test(degree)) return "ba";
  return "";
}

function preferredCsPages(pages, options = {}) {
  const selectedDegree = degreeKind(options.primaryResource?.degree || options.degree || "") || "bs";
  const primaryUrl = options.primaryResource?.url;
  const isComparison = /\bcompare\b|\bdifference between\b|\bversus\b|\bvs\.?\b/i.test(options.question || "");
  const compatiblePages = (pages || []).filter((page) => {
    if (isComparison || page.url === primaryUrl || page.canonicalUrl === primaryUrl) return true;
    const value = lower(`${page.title} ${page.url}`).replace(/[^a-z0-9]+/g, " ");
    const isBa = value.includes("computer science ba") || value.includes("bachelor of arts") || value.includes("bacs");
    const isBs = value.includes("degree requirements bscs") || value.includes("program sumary bscs") || value.includes("program summary bscs") || value.includes("bachelor of science");
    return selectedDegree === "bs" ? !isBa : !isBs;
  });
  return [...compatiblePages].sort((a, b) => {
    const score = (page) => {
      const value = lower(`${page.title} ${page.url}`).replace(/[^a-z0-9]+/g, " ");
      const isBa = value.includes("computer science ba") || value.includes("bachelor of arts") || value.includes("bacs");
      const isBs = value.includes("degree requirements bscs") || value.includes("program sumary bscs") || value.includes("bachelor of science");
      return (page.url === primaryUrl || page.canonicalUrl === primaryUrl ? 100 : 0) +
        (value.includes("program summary") ? 8 : 0) +
        (value.includes("flowchart") ? 7 : 0) +
        (value.includes("degree requirements") ? 6 : 0) +
        (value.includes("university catalog") ? 4 : 0) +
        (value.includes("course description") ? 1 : 0) +
        (selectedDegree === "bs" && isBs ? 8 : 0) +
        (selectedDegree === "ba" && isBa ? 8 : 0) -
        (selectedDegree === "bs" && isBa ? 100 : 0) -
        (selectedDegree === "ba" && isBs ? 100 : 0);
    };
    return score(b) - score(a);
  });
}

function headerIndexes(headers) {
  const values = headers.map(lower);
  return {
    title: values.findIndex((value) => /course title|title|course name/.test(value)),
    code: values.findIndex((value) => /course number|course code|prefix/.test(value)),
    credits: values.findIndex((value) => /credit/.test(value))
  };
}

function courseRows(table) {
  const indexes = headerIndexes(table.headers || []);
  return (table.rows || []).map((row) => {
    const joined = row.join(" ");
    const detectedCode = joined.match(COURSE_CODE)?.join(" or ") || "";
    const code = normalize(indexes.code >= 0 ? row[indexes.code] : detectedCode);
    const title = normalize(indexes.title >= 0 ? row[indexes.title] : row.find((cell) => !COURSE_CODE_TEST.test(cell) && !/^\d+(?:-\d+)?$/.test(cell)));
    const credits = normalize(indexes.credits >= 0 ? row[indexes.credits] : row.find((cell) => /^\d+(?:-\d+)?$/.test(cell)));
    return { code, title, credits };
  }).filter((row) => COURSE_CODE_TEST.test(row.code) && row.title && !/subtotal|total/i.test(row.title));
}

function courseTablesFor(question, pages, options = {}) {
  const query = lower(question);
  const wantsMath = /\bmath(?:ematics)?\b/.test(query);
  const wantsElectives = /\belectives?\b/.test(query);
  const seenCodes = new Set();
  const collectedTables = [];
  let firstPage = null;
  for (const page of preferredCsPages(pages, options)) {
    const sections = page.sections || [];
    const electivesIndex = sections.findIndex((section) => /^electives?\b/i.test(section.heading));
    const selectedSections = sections.filter((section, index) => {
      if (wantsMath) return /^mathematics?\b|\bmath requirements?\b/i.test(section.heading);
      if (wantsElectives) return electivesIndex >= 0 && index >= electivesIndex;
      return !/general education|program summary/i.test(section.heading);
    });
    let tables = selectedSections.flatMap((section) => (section.tables || []).map((table) => {
      const rows = courseRows(table);
      const courses = rows.map((row) => ({
        ...row,
        sourceUrl: page.canonicalUrl || page.url,
        sourceTitle: page.title
      }));
      return rows.length ? {
        heading: section.heading,
        headers: ["Course", "Title", "Credits"],
        courses,
        sourceSection: section
      } : null;
    }).filter(Boolean));
    if (tables.length && !wantsMath && !wantsElectives) {
      const priority = (heading) => /^(common core|computer science - computer engineering core|computer science core)$/i.test(heading) ? 0 :
        /mathematics|science/i.test(heading) ? 1 : /semi-core/i.test(heading) ? 2 : 3;
      tables = tables.sort((a, b) => priority(a.heading) - priority(b.heading));
    }
    if (tables.length) {
      tables = tables.map((table) => ({
        ...table,
        courses: table.courses.filter((course) => {
          const code = lower(course.code).replace(/\s+/g, "");
          if (seenCodes.has(code)) return false;
          seenCodes.add(code);
          return true;
        })
      })).filter((table) => table.courses.length);
      if (tables.length) {
        firstPage ||= page;
        collectedTables.push(...tables);
      }
    }
  }
  return collectedTables.length ? { page: firstPage, tables: collectedTables, wantsMath, wantsElectives } : null;
}

function courseAnswer(question, pages, options = {}) {
  const result = courseTablesFor(question, pages, options);
  if (!result) return null;
  const { page, tables, wantsMath, wantsElectives } = result;
  const rowCount = tables.reduce((total, table) => total + table.courses.length, 0);
  const allRequested = /\b(?:all|complete|every)\b/i.test(question);
  const degree = degreeKind(options.primaryResource?.degree) === "ba" ? "B.A." : "B.S.";
  let title = `Computer Science ${degree} Courses`;
  let summary = `The official Computer Science ${degree} curriculum lists ${rowCount} unique course entries across ${tables.length} groups.`;
  if (wantsMath) {
    title = `Computer Science ${degree} Math Requirements`;
    const credits = tables.flatMap((table) => table.courses).reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
    summary = `The Computer Science ${degree} requires ${credits} credits across the mathematics courses listed below.`;
  } else if (wantsElectives) {
    title = `Computer Science ${degree} Electives`;
    const electiveSection = (page.sections || []).find((section) => /^electives?\b/i.test(section.heading));
    const creditMatch = (electiveSection?.paragraphs || []).join(" ").match(/\b(\d+)\s+credits?\b/i);
    summary = creditMatch
      ? `The Computer Science ${degree} requires ${creditMatch[1]} credits of electives. FAU groups suggested electives by area below.`
      : "FAU groups the suggested Computer Science electives by area below.";
  }
  if (/flowchart/i.test(options.primaryResource?.title || "")) title = options.primaryResource.title;
  const cleanTables = tables.map(({ sourceSection: _sourceSection, ...table }) => ({
    ...table,
    rows: table.courses.map((course) => [course.code, course.title, course.credits])
  }));
  const courseSources = tables.map((table) => {
    const sourceUrl = table.courses[0]?.sourceUrl;
    const sourcePage = (pages || []).find((item) => item.url === sourceUrl || item.canonicalUrl === sourceUrl) || page;
    const courseSource = sourceFor(sourcePage, table.sourceSection, `${table.courses[0].code} ${table.courses[0].title} ${table.courses[0].credits}`);
    if (sourcePage.url === options.primaryResource?.url || sourcePage.canonicalUrl === options.primaryResource?.url) {
      courseSource.title = options.primaryResource.title || courseSource.title;
    }
    return courseSource;
  }).filter((source, index, sources) => sources.findIndex((item) => item.url === source.url) === index);
  return {
    applicable: true,
    found: true,
    sources: courseSources,
    groundedAnswer: {
      verified: true,
      type: "table",
      title,
      summary,
      sections: [],
      tables: cleanTables,
      steps: [],
      facts: [],
      nextSteps: [],
      display: { initialRowLimit: allRequested ? rowCount : Math.min(10, rowCount), showAll: allRequested }
    }
  };
}

function creditAnswer(question, pages, options = {}) {
  if (!/\b(?:cs|computer science)\b/i.test(question) || !/\bcredits?\b/i.test(question)) return null;
  const degreeLabel = degreeKind(options.primaryResource?.degree) === "ba" ? "B.A." : "B.S.";
  for (const page of preferredCsPages(pages, options)) {
    for (const section of page.sections || []) {
      const evidence = [...(section.paragraphs || []), section.heading].find((text) => /minimum number of credits|required.*120 credits|requires? 120 credits/i.test(text));
      const match = evidence?.match(/\b(\d{2,3})\s+credits?\b/i);
      if (!match) continue;
      return {
        applicable: true,
        found: true,
        sources: [sourceFor(page, section, evidence)],
        groundedAnswer: {
          verified: true, type: "short_fact", title: `Computer Science ${degreeLabel} Credits`,
          summary: `The FAU Computer Science ${degreeLabel} requires at least ${match[1]} credits.`,
          facts: [{ label: "Minimum credits", value: match[1] }], sections: [], tables: [], steps: [], nextSteps: []
        }
      };
    }
  }
  return null;
}

function requirementAnswer(question, pages, options = {}) {
  if (!/\b(?:cs|computer science)\b/i.test(question) || !/\brequirements?\b/i.test(question)) return null;
  const ordered = preferredCsPages(pages, options);
  const selected = options.primaryResource;
  const selectedDegree = degreeKind(selected?.degree) === "ba" ? "ba" : "bs";
  const degreeLabel = selectedDegree === "ba" ? "B.A." : "B.S.";
  const primaryPage = ordered.find((page) => page.url === selected?.url || page.canonicalUrl === selected?.url) || ordered[0];
  const supportingPages = ordered.filter((page) => page !== primaryPage && (page.sections || []).some((section) => (section.tables || []).some((table) => courseRows(table).length))).slice(0, 3);
  const supportingPage = supportingPages[0];
  if (!primaryPage) return null;
  const summaryPage = supportingPage || primaryPage;
  const paragraphs = (primaryPage.sections || []).flatMap((section) => section.paragraphs || []);
  const creditEvidence = paragraphs.find((text) => /minimum number of credits/i.test(text)) || (summaryPage?.sections || []).map((section) => section.heading).find((text) => /requires?\s+\d+\s+credits/i.test(text));
  const credit = creditEvidence?.match(/\b(\d{2,3})\s+credits?\b/i)?.[1];
  const gradeEvidence = paragraphs.find((text) => /grade of ["“]?[A-F]["”]? or better/i.test(text));
  const grade = gradeEvidence?.match(/grade of ["“]?([A-F])["”]? or better/i)?.[1];
  const summarySection = (summaryPage.sections || []).find((section) => /program summary/i.test(section.heading));
  const programRows = summarySection?.tables?.[0]?.rows || [];
  const areas = programRows.filter((row) => row[0] && !/subtotal|total/i.test(row[0])).map((row) => `${row[0]} — ${row.at(-1)} credits`);
  const requiredTablesResult = courseTablesFor("computer science required courses", [primaryPage, ...supportingPages], options);
  const requiredCourses = (requiredTablesResult?.tables || [])
    .filter((table) => /common core|computer science.*core/i.test(table.heading))
    .flatMap((table) => table.courses);
  const requiredCourseMap = new Map();
  requiredCourses.forEach((course) => {
    const key = lower(course.code).replace(/\s+/g, "");
    if (!requiredCourseMap.has(key)) requiredCourseMap.set(key, course);
  });
  const uniqueRequired = [...requiredCourseMap.values()];
  const requirementTable = uniqueRequired.length ? [{
    heading: "Required Computer Science Courses", headers: ["Course", "Title", "Credits"],
    courses: uniqueRequired, rows: uniqueRequired.map((course) => [course.code, course.title, course.credits])
  }] : [];
  const detailSections = (summaryPage.sections || []).filter((section) => /^(mathematics|science|electives?)\b/i.test(section.heading)).map((section) => {
    const courses = (section.tables || []).flatMap(courseRows);
    const items = courses.length
      ? courses.map((course) => `${course.code} — ${course.title} — ${course.credits} credits`)
      : (section.paragraphs || []).filter((paragraph) => paragraph.length <= 280);
    return items.length ? { heading: section.heading, items } : null;
  }).filter(Boolean);
  const sourceSection = primaryPage.sections?.find((section) => /degree requirements/i.test(section.heading)) || primaryPage.sections?.[0];
  const primarySource = sourceFor(primaryPage, sourceSection, creditEvidence || gradeEvidence || "Official degree requirements");
  primarySource.title = selected?.title || `Computer Science ${degreeLabel} Degree Requirements`;
  const supportingSourcePages = [summaryPage, ...supportingPages].filter((page) => page && page !== primaryPage)
    .filter((page, index, list) => list.findIndex((item) => (item.canonicalUrl || item.url) === (page.canonicalUrl || page.url)) === index);
  const supportingSources = supportingSourcePages.map((page) => {
    const course = uniqueRequired.find((item) => item.sourceUrl === (page.canonicalUrl || page.url));
    const section = page.sections?.find((item) => /core|program summary|mathematics|science|electives?/i.test(item.heading)) || page.sections?.[0];
    return sourceFor(page, section, course ? `${course.code} ${course.title}` : section?.paragraphs?.[0]);
  });
  if (!credit && !grade && !areas.length && !uniqueRequired.length) return null;
  return {
    applicable: true,
    found: Boolean(credit || grade || areas.length || uniqueRequired.length),
    sources: [primarySource, ...supportingSources],
    groundedAnswer: {
      verified: Boolean(credit || grade || areas.length || uniqueRequired.length), type: "requirements", title: selected?.title || `Computer Science ${degreeLabel} Degree Requirements`,
      summary: credit ? `The FAU Computer Science ${degreeLabel} requires at least ${credit} total credits.` : `The official Computer Science ${degreeLabel} requirements are organized below.`,
      facts: [credit ? { label: "Total credits", value: credit } : null, grade ? { label: "Minimum grade", value: `${grade} or better` } : null].filter(Boolean),
      sections: detailSections.length ? detailSections : areas.length ? [{ heading: "Program Areas", items: areas }] : [], tables: requirementTable, steps: [], nextSteps: [],
      display: { initialRowLimit: Math.min(10, uniqueRequired.length), showAll: false }
    }
  };
}

function withdrawalSteps(question, pages) {
  if (!/\bhow\b.*\b(?:withdraw|drop)\b|\bsteps?\b.*\b(?:withdraw|drop)\b/i.test(question)) return null;
  for (const page of pages || []) {
    for (const section of page.sections || []) {
      const list = (section.lists || []).find(({ items }) => items.some((item) => /Drop via Web with W Grade/i.test(item)) && items.some((item) => /^Submit$/i.test(item)));
      if (!list) continue;
      const evidence = (section.paragraphs || []).find((text) => /considered a withdrawal/i.test(text)) || "";
      const important = [];
      if (/result in a ["“]W/i.test(evidence)) important.push("Dropping after the drop/add period is a withdrawal and results in a “W” on your transcript.");
      if (/fee liable/i.test(evidence)) important.push("Courses on your schedule after drop/add ends are fee liable.");
      if (/Academic Calendar/i.test(evidence)) important.push("Check the Academic Calendar deadline for the specific part of term before changing your schedule.");
      const deadline = extractDateAnswer("withdrawal deadline", pages);
      const deadlineFact = deadline.found ? { label: "Withdrawal deadline", value: deadline.groundedAnswer.summary.replace(/^.*? is /, "").replace(/\.$/, "") } : null;
      return {
        applicable: true,
        found: true,
        sources: [sourceFor(page, section, [...list.items, evidence].join(" ")), ...(deadline.source ? [deadline.source] : [])],
        groundedAnswer: {
          verified: true, type: "steps", title: "How to Withdraw From a Class",
          summary: "Use MyFAU registration to withdraw from an individual course.",
          steps: list.items.map(normalize), sections: important.length ? [{ heading: "Important", items: important }] : [],
          tables: [], facts: deadlineFact ? [deadlineFact] : [], nextSteps: []
        }
      };
    }
  }
  return null;
}

function addClassSteps(question, pages) {
  if (!/\bhow\b.*\badd\b.*\b(?:class|course)\b/i.test(question)) return null;
  for (const page of pages || []) {
    const section = (page.sections || []).find((item) => /how do i add and drop courses/i.test(item.heading));
    const list = section?.lists?.find(({ items }) => items.some((item) => /MyFAU/i.test(item)) && items.some((item) => /Register for Classes/i.test(item)));
    if (!section || !list) continue;
    const deadline = extractDateAnswer("when is add/drop", pages);
    const deadlineValue = deadline.found ? deadline.groundedAnswer.facts?.[0]?.value : null;
    const policy = (section.paragraphs || []).find((text) => /without incurring a fee.*without receiving a ['“]W/i.test(text));
    const important = [];
    if (policy) important.push("During drop/add, courses may be added or dropped without a fee and dropped courses do not receive a “W.”");
    important.push("Use the Academic Calendar date for your course's specific part of term.");
    return {
      applicable: true, found: true,
      sources: [sourceFor(page, section, [...list.items, policy].join(" ")), ...(deadline.source ? [deadline.source] : [])],
      groundedAnswer: {
        verified: true, type: "steps", title: "How to Add a Class",
        summary: "Open the registration screen in MyFAU, then select the course you want to add.",
        steps: list.items.map(normalize), facts: deadlineValue ? [{ label: "Add/drop deadline", value: deadlineValue }] : [],
        sections: [{ heading: "Important", items: important }], tables: [], nextSteps: []
      }
    };
  }
  return null;
}

export function structureGroundedAnswer(question, pages, options = {}) {
  const overview = broadCalendarAnswer(question, pages, options);
  if (overview) return overview;
  const date = extractDateAnswer(question, pages, options);
  if (date.applicable) {
    const faqPage = /\b(?:add|drop)\b/i.test(question) ? (pages || []).find((page) => /registration\/faqs|registration.*faq/i.test(`${page.url} ${page.title}`)) : null;
    const faqSection = faqPage?.sections?.find((section) => /add and drop courses/i.test(section.heading));
    const sources = [date.source, faqPage && faqSection ? sourceFor(faqPage, faqSection, faqSection.paragraphs?.[0]) : null].filter(Boolean);
    return {
      ...date,
      sources,
      groundedAnswer: { ...date.groundedAnswer, type: "date", steps: [], facts: date.groundedAnswer.facts || [], display: {} }
    };
  }
  const type = classifyAnswerType(question);
  const result = type === "steps" ? addClassSteps(question, pages) || withdrawalSteps(question, pages) :
    type === "short_fact" ? creditAnswer(question, pages, options) :
      type === "requirements" ? requirementAnswer(question, pages, options) :
        type === "table" || type === "list" ? courseAnswer(question, pages, options) : null;
  if (result) return result;
  return { applicable: false, expectedType: type };
}

export function isRawScrapedSummary(value) {
  return RAW_TABLE_TEXT.test(value) || (normalize(value).split("|").length >= 4);
}
