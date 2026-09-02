const NOT_VERIFIED = "I found the relevant FAU page, but I couldn't verify the exact date from the content I retrieved.";

const MONTHS = {
  jan: "January", january: "January", feb: "February", february: "February",
  mar: "March", march: "March", apr: "April", april: "April", may: "May",
  jun: "June", june: "June", jul: "July", july: "July", aug: "August", august: "August",
  sep: "September", sept: "September", september: "September", oct: "October", october: "October",
  nov: "November", november: "November", dec: "December", december: "December"
};
const DATE_PATTERN = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;
const TERM_PATTERN = /\b(fall|spring|summer)\s+(20\d{2})\b/i;

function normalize(value = "") {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
}

function queryIntent(query) {
  const value = normalize(query).toLowerCase();
  let event = null;
  if (/\b(commencement|graduation)\b/.test(value)) event = "commencement";
  else if (/\bfinal(?:s|\s+exams?|\s+examinations?)\b/.test(value)) event = "final_exams";
  else if (/\b(semester|classes?|term)\b.*\b(start|begin)|\b(start|begin).*(semester|classes?|term)\b/.test(value)) event = "classes_begin";
  else if (/\bwithdraw(?:al)?\b/.test(value)) event = "withdrawal";
  else if (/drop\s*\/\s*add|add\s*\/\s*drop|drop and add|add and drop/.test(value)) event = "add_drop";
  else if (/\badd\b/.test(value)) event = "add";
  else if (/\bdrop\b/.test(value)) event = "drop";
  if (!event) return null;
  const asksForTiming = /\bwhen\b|\bwhat date\b|\bdeadline\b|\blast day\b|\bcommencement\b|\bsemester start\b|\bclasses? (?:start|begin)|drop\s*\/\s*add|add\s*\/\s*drop/.test(value);
  if (!asksForTiming) return null;
  const explicitTerm = value.match(/\b(fall|spring|summer)\b/)?.[1] || null;
  const explicitYear = value.match(/\b(20\d{2})\b/)?.[1] || null;
  return { event, term: explicitTerm, year: explicitYear };
}

function datesFrom(value, fallbackYear) {
  const dates = [];
  for (const match of normalize(value).matchAll(DATE_PATTERN)) {
    const month = MONTHS[match[1].toLowerCase().replace(".", "")];
    if (!month) continue;
    dates.push({ month, day: Number(match[2]), year: match[3] || fallbackYear || null });
  }
  return dates;
}

function eventMatches(event, value) {
  const text = normalize(value).toLowerCase();
  if (event === "commencement") return /\bcommencement\b/.test(text) && !/application|apply|deadline|information|details|ticket/.test(text);
  if (event === "final_exams") return /\bfinal (?:exam|exams|examination|examinations)\b/.test(text);
  if (event === "classes_begin") return /\b(classes|semester|term) (?:begin|begins|start|starts)\b/.test(text);
  if (["add_drop", "add", "drop"].includes(event)) return /\blast day\b.*\b(?:drop.*add|add.*drop)\b/.test(text);
  return /\blast day\b.*(?:\bdrop\b.*\bwith\b.*\bw\b|\bwithdraw(?:al)?\b)/.test(text) && !/\bwithout\b|25%|tuition adjustment/.test(text);
}

function getPreferredTerm(now) {
  const month = now.getMonth() + 1;
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "fall";
}

function candidateDatesFromRow(row, headers, year) {
  const fullTermIndex = headers.findIndex((header) => /full term|full semester|15.?week/i.test(header));
  const eventIndex = row.findIndex((cell) => /commencement|final exam|classes (?:begin|start)|last day.*(?:drop|add|withdraw)/i.test(cell));
  if (fullTermIndex >= 0 && fullTermIndex < row.length) {
    const selected = datesFrom(row[fullTermIndex], year);
    if (selected.length) return selected;
  }
  const dateCells = row.filter((_cell, index) => index !== eventIndex);
  for (const cell of dateCells) {
    const selected = datesFrom(cell, year);
    if (selected.length) return selected;
  }
  return datesFrom(row.join(" "), year);
}

function collectCandidates(pages, intent) {
  const candidates = [];
  for (const page of pages || []) {
    let activeTerm = null;
    let activeYear = null;
    for (const section of page.sections || []) {
      const termMatch = normalize(section.heading).match(TERM_PATTERN);
      if (termMatch) {
        activeTerm = termMatch[1].toLowerCase();
        activeYear = termMatch[2];
      }
      const context = `${section.heading} ${(section.paragraphs || []).join(" ")}`;
      const contextualTerm = context.match(TERM_PATTERN);
      const term = contextualTerm?.[1]?.toLowerCase() || activeTerm;
      const year = contextualTerm?.[2] || activeYear;

      for (const [tableIndex, table] of (section.tables || []).entries()) {
        const headers = table.headers || [];
        for (const row of table.rows || []) {
          const rowText = row.join(" | ");
          if (!eventMatches(intent.event, rowText)) continue;
          const dates = candidateDatesFromRow(row, headers, year);
          if (!dates.length) continue;
          candidates.push({ page, section, table, tableIndex, row, rowText, dates, term, year });
        }
      }

      const looseItems = [
        ...(section.paragraphs || []),
        ...(section.lists || []).flatMap((list) => list.items || []),
        ...(section.definitions || []).map((entry) => `${entry.term}: ${entry.definition}`)
      ];
      for (const text of looseItems) {
        if (!eventMatches(intent.event, text)) continue;
        const dates = datesFrom(text, year);
        if (dates.length) candidates.push({ page, section, rowText: text, dates, term, year });
      }
    }
  }
  return candidates;
}

function chooseCandidates(candidates, intent, now) {
  let filtered = candidates;
  if (intent.term) filtered = filtered.filter((candidate) => candidate.term === intent.term);
  if (intent.year) filtered = filtered.filter((candidate) => candidate.year === intent.year || candidate.dates.some((date) => date.year === intent.year));
  if (!filtered.length) return [];

  if (!intent.term) {
    const preferredTerm = getPreferredTerm(now);
    const preferred = filtered.filter((candidate) => candidate.term === preferredTerm);
    if (preferred.length) filtered = preferred;
  }
  if (!intent.year) {
    const currentYear = String(now.getFullYear());
    const current = filtered.filter((candidate) => candidate.year === currentYear || candidate.dates.some((date) => date.year === currentYear));
    if (current.length) filtered = current;
  }
  const fullTerm = filtered.filter((candidate) => /full term|full semester|15.?week/i.test(`${candidate.section?.heading || ""} ${candidate.table?.heading || ""}`));
  if (fullTerm.length) filtered = fullTerm;
  else {
    const firstTableIndex = Math.min(...filtered.map((candidate) => candidate.tableIndex).filter(Number.isInteger));
    if (Number.isFinite(firstTableIndex)) filtered = filtered.filter((candidate) => candidate.tableIndex === firstTableIndex);
  }
  return filtered;
}

function uniqueDates(candidates) {
  const seen = new Set();
  return candidates.flatMap((candidate) => candidate.dates).filter((date) => {
    const key = `${date.month}-${date.day}-${date.year || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatOne(date, includeYear = true) {
  return `${date.month} ${date.day}${includeYear && date.year ? `, ${date.year}` : ""}`;
}

function formatDateList(dates) {
  if (dates.length === 1) return formatOne(dates[0]);
  const sameMonth = dates.every((date) => date.month === dates[0].month);
  const sameYear = dates.every((date) => date.year === dates[0].year);
  if (dates.length === 2 && sameMonth && sameYear) return `${dates[0].month} ${dates[0].day} and ${dates[1].day}${dates[0].year ? `, ${dates[0].year}` : ""}`;
  if (dates.length === 2 && sameYear) return `${formatOne(dates[0], false)} and ${formatOne(dates[1])}`;
  return dates.map((date) => formatOne(date)).join(", ");
}

function termLabel(candidate, intent) {
  const term = candidate.term || intent.term;
  const year = candidate.year || intent.year || candidate.dates.find((date) => date.year)?.year;
  return [term ? `${term[0].toUpperCase()}${term.slice(1)}` : "", year || ""].filter(Boolean).join(" ");
}

function importantNotes(candidate) {
  const text = candidate.rowText;
  const items = [];
  if (/in person by 5pm/i.test(text) && /online by 11:59pm/i.test(text)) items.push("In-person changes are due by 5 p.m.; online changes are due by 11:59 p.m.");
  if (/courses are fee liable after this date/i.test(text)) items.push("Courses are fee liable after this date.");
  if (/\$100 late registration fee after this date/i.test(text)) items.push("A $100 late-registration fee applies after this date.");
  return items.length ? [{ heading: "Important", items }] : [];
}

function directAnswer(intent, candidates) {
  const first = candidates[0];
  const label = termLabel(first, intent);
  if (intent.event === "final_exams") {
    const starts = candidates.filter((candidate) => /\bbegin|\bstart/i.test(candidate.rowText));
    const ends = candidates.filter((candidate) => /\bend/i.test(candidate.rowText));
    const start = uniqueDates(starts)[0];
    const end = uniqueDates(ends)[0];
    if (start && end) return { summary: `${label ? `${label} ` : ""}final exams are scheduled from ${formatOne(start, false)} through ${formatOne(end)}.`, title: `${label} Final Exams`.trim(), facts: [], sections: [] };
    const dates = uniqueDates(candidates);
    return dates.length ? { summary: `${label ? `${label} ` : ""}final exams are scheduled for ${formatDateList(dates)}.`, title: `${label} Final Exams`.trim(), facts: [], sections: [] } : null;
  }
  const dates = uniqueDates(candidates);
  if (!dates.length) return null;
  const dateText = formatDateList(dates);
  if (intent.event === "commencement") return { summary: `${label ? `${label} ` : ""}commencement is scheduled for ${dateText}.`, title: `${label} Commencement`.trim(), facts: [], sections: [] };
  if (intent.event === "classes_begin") return { summary: `${label ? `${label} ` : ""}classes begin ${dateText}.`, title: `${label} Semester Start`.trim(), facts: [], sections: [] };
  if (intent.event === "add_drop") return {
    summary: `The ${label || "selected term"} add/drop deadline is ${dateText}.`,
    title: `${label} Add / Drop`.trim(),
    facts: [{ label: "Add deadline", value: dateText }, { label: "Drop deadline", value: dateText }],
    sections: importantNotes(first)
  };
  if (intent.event === "add") return { summary: `For ${label || "the selected term"}, the last day to add a class is ${dateText}.`, title: `${label} Add Deadline`.trim(), facts: [], sections: importantNotes(first) };
  if (intent.event === "drop") return { summary: `For ${label || "the selected term"}, the last day to drop a class during drop/add is ${dateText}.`, title: `${label} Drop Deadline`.trim(), facts: [], sections: importantNotes(first) };
  return { summary: `The ${label || "selected term"} withdrawal deadline is ${dateText}.`, title: `${label} Withdrawal Deadline`.trim(), facts: [], sections: importantNotes(first) };
}

export function extractDateAnswer(question, pages, { now = new Date() } = {}) {
  const intent = queryIntent(question);
  if (!intent) return { applicable: false };
  const selected = chooseCandidates(collectCandidates(pages, intent), intent, now);
  const answer = selected.length ? directAnswer(intent, selected) : null;
  if (!answer) {
    return {
      applicable: true,
      found: false,
      groundedAnswer: { verified: false, title: "Date not verified", summary: NOT_VERIFIED, sections: [], tables: [], facts: [], nextSteps: [] }
    };
  }
  const first = selected[0];
  const source = {
    title: first.page.title || "Academic Calendar | Florida Atlantic University",
    url: first.page.canonicalUrl || first.page.url,
    sectionHeading: first.section.heading,
    excerpt: first.rowText
  };
  return {
    applicable: true,
    found: true,
    source,
    groundedAnswer: {
      verified: true,
      title: answer.title,
      summary: answer.summary,
      sections: answer.sections,
      tables: [],
      facts: answer.facts,
      nextSteps: []
    }
  };
}

export { NOT_VERIFIED };
