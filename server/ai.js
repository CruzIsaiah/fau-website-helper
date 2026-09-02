import OpenAI from "openai";
import { isRawScrapedSummary, structureGroundedAnswer } from "./answerStructuring.js";
import { fetchFauPage, fetchFauPageText } from "./pageReader.js";
import { retrieveTopChunks } from "./retrieval.js";
import { rankPageChunks, rankPageLinks, retrieveFauContent } from "./research.js";
import { rankFauResources } from "./search.js";

const ACADEMIC_CALENDAR_URL = "https://www.fau.edu/registrar/registration/calendar/";
const MYFAU_URL = "https://myfau.fau.edu/";

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OpenAI API key is not configured.");
    error.status = 503;
    error.code = "missing_api_key";
    throw error;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function createJsonResponse({ system, user, fallback }) {
  if (process.env.NODE_ENV === "test" || !process.env.OPENAI_API_KEY) return fallback;
  try {
    const response = await getClient().chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    });
    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error) {
    if (error.status === 429) {
      const rateError = new Error("The AI service is busy right now. Please wait a moment and try again.");
      rateError.status = 429;
      rateError.code = "rate_limited";
      throw rateError;
    }
    const apiError = new Error("The FAU helper could not complete that AI request. Please try again.");
    apiError.status = error.status || 502;
    apiError.code = "ai_request_failed";
    throw apiError;
  }
}

function localAnswer(question, ranked, resources) {
  const intents = ranked.analysis.intents;
  const top = resources.find((resource) => resource.id === ranked.matches[0]?.resourceId);
  if (ranked.confidenceLevel === "low" || !top) {
    return "I could not find a strong match. Try one of the suggested searches or browse the closest official FAU resources.";
  }
  if (intents.includes("registration")) {
    return `To register for classes: 1. Log in to MyFAU: ${MYFAU_URL} 2. Open registration and choose Register for Classes. 3. Select the term, find your classes, add them, and submit. 4. Check the Academic Calendar for registration and add/drop dates: ${ACADEMIC_CALENDAR_URL}`;
  }
  if (intents.includes("deadlines") && (intents.includes("graduation") || intents.includes("withdrawal") || /semester|calendar/i.test(question))) {
    const event = intents.includes("graduation") ? "graduation" : intents.includes("withdrawal") ? "drop or withdrawal" : "semester";
    return `Dates vary by term. Check the official FAU Academic Calendar for the current ${event} deadline or event date: ${ACADEMIC_CALENDAR_URL}`;
  }
  if (intents.includes("program_requirements") && top.program) {
    return `The strongest official source is ${top.title}. It covers the ${top.program} ${top.degree || "program"} curriculum and requirements. Open the source below for the current, authoritative details.`;
  }
  if (ranked.confidenceLevel === "medium") {
    return `I found related FAU resources, but couldn't verify an exact answer. ${top.title} is the best official starting point.`;
  }
  return `${top.title} is the strongest official FAU source for this question.`;
}

function sourceList(matches, resources) {
  return matches.slice(0, 4).map((match) => {
    const resource = resources.find((item) => item.id === match.resourceId);
    return resource ? { resourceId: resource.id, title: resource.title, url: resource.url } : null;
  }).filter(Boolean);
}

export async function matchFauResources({ question, resources, useIndex = true, skipPageAnswer = false }) {
  let semanticMatches = [];
  if (useIndex && process.env.NODE_ENV !== "test" && process.env.OPENAI_API_KEY) {
    try {
      semanticMatches = await retrieveTopChunks(question, 8);
    } catch {
      semanticMatches = [];
    }
  }

  const debug = process.env.SEARCH_DEBUG === "true" && process.env.NODE_ENV !== "production";
  const ranked = rankFauResources(question, resources, { semanticMatches, debug });
  const sources = sourceList(ranked.matches, resources);
  const fallbackAnswer = localAnswer(question, ranked, resources);
  const base = {
    answer: fallbackAnswer,
    matches: ranked.matches.map(({ score, scoreBreakdown, ...match }) => ({
      ...match,
      ...(debug ? { score, scoreBreakdown } : {})
    })),
    sources,
    confidenceLevel: ranked.confidenceLevel,
    clarification: ranked.clarification,
    suggestions: ranked.suggestions,
    understanding: {
      normalizedQuery: ranked.analysis.normalizedQuery,
      intents: ranked.analysis.intents,
      concepts: ranked.analysis.matchedConcepts
    }
  };

  if (skipPageAnswer || !process.env.OPENAI_API_KEY || process.env.NODE_ENV === "test" || ranked.confidenceLevel === "low" || sources.length === 0) return base;

  let pageSources = semanticMatches
    .filter((result) => ranked.matches.some((match) => match.resourceId === result.resourceId))
    .slice(0, 6)
    .map((result) => ({ resourceId: result.resourceId, title: result.title, url: result.url, text: result.text }));

  if (pageSources.length === 0) {
    const fetched = await Promise.allSettled(sources.slice(0, 3).map(async (source) => {
      const page = await fetchFauPageText(source.url);
      return { ...source, title: page.title || source.title, text: page.text.slice(0, 3500) };
    }));
    pageSources = fetched.filter((result) => result.status === "fulfilled").map((result) => result.value);
  }
  if (pageSources.length === 0) return base;

  const answerData = await createJsonResponse({
    fallback: { answer: fallbackAnswer },
    system:
      "Answer the student's FAU question using only the official page excerpts provided. Return JSON with only an answer field. Be concise and actionable. Cite supporting excerpts with [1], [2], etc., in the order given. Never invent requirements, credits, dates, policies, or steps. If the excerpts do not verify an exact answer, explicitly say that and direct the student to the relevant source.",
    user: `Question: ${question}\n\nOfficial sources:\n${pageSources.map((source, index) => `[${index + 1}] ${source.title}\n${source.url}\n${source.text}`).join("\n\n")}`
  });
  return { ...base, answer: answerData.answer || fallbackAnswer };
}

function conciseExcerpt(text, limit = 520) {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean);
  return (sentences.slice(0, 3).join(" ") || text).slice(0, limit).trim();
}

function localGroundedAnswer(retrieval, topResource) {
  if (retrieval.chunks.length === 0) {
    return {
      verified: false,
      type: "summary",
      title: topResource?.title || "Official FAU resource found",
      summary: "I found the relevant official FAU page, but couldn't automatically read enough of its content to verify an answer.",
      sections: [],
      tables: [],
      nextSteps: []
    };
  }
  const topChunks = retrieval.chunks.slice(0, 4);
  const sectionKeys = new Set();
  const sections = topChunks.map((chunk) => {
    const items = chunk.lists.flatMap((list) => list.items).slice(0, 8);
    const definitions = chunk.definitions.slice(0, 6).map((entry) => `${entry.term}: ${entry.definition}`);
    return { heading: chunk.sectionHeading, items: [...items, ...definitions].slice(0, 8) };
  }).filter((section) => {
    const key = `${section.heading}|${section.items.join("|")}`;
    if (section.items.length === 0 || sectionKeys.has(key)) return false;
    sectionKeys.add(key);
    return true;
  });
  const tableKeys = new Set();
  const tables = topChunks.flatMap((chunk) => chunk.tables.map((table) => ({
    heading: table.heading || chunk.sectionHeading,
    headers: table.headers,
    rows: table.rows.slice(0, 14)
  }))).filter((table) => {
    const key = `${table.heading}|${table.headers.join("|")}|${JSON.stringify(table.rows)}`;
    if (tableKeys.has(key)) return false;
    tableKeys.add(key);
    return true;
  }).slice(0, 2);
  const firstParagraph = topChunks.flatMap((chunk) => chunk.paragraphs || []).find((paragraph) => paragraph.length >= 20);
  const hasStructuredData = sections.length > 0 || tables.length > 0;
  return {
    verified: true,
    type: tables.length ? "table" : sections.length ? "list" : "summary",
    title: topChunks[0].pageTitle || topResource?.title || "Answer from FAU sources",
    summary: firstParagraph
      ? conciseExcerpt(firstParagraph, 320)
      : hasStructuredData
        ? "I found relevant structured information in the official FAU source below."
        : "I found the relevant official FAU page. Open the source below for the complete information.",
    sections: sections.slice(0, 3),
    tables,
    steps: [],
    facts: [],
    nextSteps: []
  };
}

async function generateGroundedAnswer(question, retrieval, topResource) {
  const fallback = localGroundedAnswer(retrieval, topResource);
  if (!process.env.OPENAI_API_KEY || process.env.NODE_ENV === "test" || retrieval.chunks.length === 0) return fallback;
  const generated = await createJsonResponse({
    fallback,
    system:
      "You are an FAU website navigation assistant. Answer the original question; do not summarize or reproduce the page. Use only the supplied official FAU excerpts. Never invent requirements, deadlines, policies, course codes, credits, costs, GPA rules, prerequisites, forms, or procedures. Return JSON with: verified (boolean), type (summary, list, table, date, deadline, requirements, steps, location, contact, comparison, or short_fact), title, summary, facts (array of {label,value}), sections (array of {heading,items}), tables (array of {heading,headers,rows}), steps (array), and nextSteps (array). Put the direct answer first. Use tables for courses, numbered steps for procedures, and short sentences for simple facts. Never place pipe-delimited table data or a large raw excerpt in summary. Include only details relevant to the query. Omit redundant and unsupported content. If evidence is insufficient, set verified false and say so.",
    user: `Question: ${question}\n\nRetrieved official FAU excerpts:\n${retrieval.chunks.map((chunk, index) => `[${index + 1}] ${chunk.pageTitle} — ${chunk.sectionHeading}\n${chunk.text}`).join("\n\n")}`
  });
  return {
    verified: generated.verified === true,
    type: generated.type || fallback.type,
    title: generated.title || fallback.title,
    summary: generated.summary && !isRawScrapedSummary(generated.summary) ? generated.summary.slice(0, 420) : fallback.summary,
    facts: Array.isArray(generated.facts) ? generated.facts : fallback.facts,
    sections: Array.isArray(generated.sections) ? generated.sections : fallback.sections,
    tables: Array.isArray(generated.tables) ? generated.tables : fallback.tables,
    steps: Array.isArray(generated.steps) ? generated.steps : fallback.steps,
    nextSteps: Array.isArray(generated.nextSteps) ? generated.nextSteps : fallback.nextSteps
  };
}

export async function researchFauQuestion({ question, resources, useIndex = true, bypassCache = false, pageFetcher }) {
  const ranked = await matchFauResources({ question, resources, useIndex, skipPageAnswer: true });
  const topResource = resources.find((resource) => resource.id === ranked.matches[0]?.resourceId);
  if (ranked.matches.length === 0) return { ...ranked, groundedAnswer: null, usefulLinks: [], retrievalStatus: "no_match" };

  const retrieval = await retrieveFauContent({
    question,
    matches: ranked.matches,
    resources,
    anchorResource: topResource,
    bypassCache,
    ...(pageFetcher ? { pageFetcher } : {})
  });
  const structured = structureGroundedAnswer(question, retrieval.pages, { primaryResource: topResource });
  const groundedAnswer = structured.applicable
    ? structured.groundedAnswer
    : await generateGroundedAnswer(question, retrieval, topResource);
  const primaryPage = retrieval.pages.find((page) => page.resourceId === topResource?.id);
  const primaryEvidence = [...(structured.sources || []), ...retrieval.sources].find((source) => source.url === (primaryPage?.canonicalUrl || primaryPage?.url));
  const primarySource = primaryPage ? {
    title: primaryEvidence?.title || primaryPage.title || topResource.title,
    url: primaryPage.canonicalUrl || primaryPage.url,
    sectionHeading: primaryEvidence?.sectionHeading || primaryPage.sections?.[0]?.heading || "",
    excerpt: primaryEvidence?.excerpt || primaryPage.text?.slice(0, 420) || ""
  } : null;
  const candidateSources = [...(structured.sources || []), ...retrieval.sources].filter((source) => source.url !== primarySource?.url);
  const structuredSources = [primarySource, ...candidateSources.filter((source, index) => source && candidateSources.findIndex((item) => item.url === source.url) === index)].filter(Boolean);

  return {
    ...ranked,
    answer: groundedAnswer.summary,
    groundedAnswer,
    sources: structuredSources.length ? structuredSources : ranked.sources,
    usefulLinks: retrieval.usefulLinks.slice(0, 8).map(({ text, href, sectionHeading, sourcePageTitle }) => ({ text, href, sectionHeading, sourcePageTitle })),
    retrievalStatus: groundedAnswer.verified ? "verified" : retrieval.rejected.length ? "source_unavailable" : "insufficient_content",
    ...(process.env.SEARCH_DEBUG === "true" && process.env.NODE_ENV !== "production" ? { retrievalDebug: retrieval.debug } : {})
  };
}

export async function summarizeFauResource({ url, title, query, originalQuery, program, degree, bypassCache = false, pageFetcher = fetchFauPage }) {
  const selectedResource = {
    id: "selected-resource", url, title: title || "Official FAU resource", program, degree,
    sourceType: "program_requirements", retrieval_priority: 20
  };
  const effectiveQuery = originalQuery || query || title || "FAU information";
  let retrieval;
  try {
    retrieval = await retrieveFauContent({
      question: effectiveQuery,
      matches: [{ resourceId: selectedResource.id }],
      resources: [selectedResource],
      pageFetcher,
      maxInitialPages: 1,
      maxFollowPages: 3,
      bypassCache,
      anchorResource: selectedResource
    });
    if (!retrieval.pages.length) throw new Error("Selected source unavailable");
  } catch {
    return {
      groundedAnswer: {
        verified: false,
        title: title || "Official FAU resource",
        summary: "I found the official FAU resource, but I could not automatically read its contents.",
        sections: [], tables: [], nextSteps: []
      },
      sources: [{ title: title || "Official FAU resource", url }],
      usefulLinks: [],
      retrievalStatus: "source_unavailable"
    };
  }
  const page = retrieval.pages.find((item) => item.resourceId === selectedResource.id) || retrieval.pages[0];
  const chunks = retrieval.chunks.length ? retrieval.chunks : rankPageChunks(effectiveQuery, retrieval.pages, 8);
  const usefulLinks = retrieval.usefulLinks.length ? retrieval.usefulLinks : rankPageLinks(effectiveQuery, retrieval.pages, 8);
  const groundedRetrieval = { ...retrieval, chunks };
  const structured = structureGroundedAnswer(effectiveQuery, retrieval.pages, { primaryResource: selectedResource });
  const groundedAnswer = structured.applicable
    ? structured.groundedAnswer
    : await generateGroundedAnswer(effectiveQuery, groundedRetrieval, selectedResource);
  const seenSources = new Set();
  const sources = chunks.map((chunk) => {
    if (seenSources.has(chunk.pageUrl)) return null;
    seenSources.add(chunk.pageUrl);
    return { title: chunk.pageTitle, url: chunk.pageUrl, sectionHeading: chunk.sectionHeading, excerpt: chunk.text.slice(0, 420) };
  }).filter(Boolean);
  const primaryEvidence = [...(structured.sources || []), ...sources].find((source) => source.url === (page.canonicalUrl || page.url));
  const primarySource = {
    title: selectedResource.title,
    url: page.canonicalUrl || page.url,
    sectionHeading: primaryEvidence?.sectionHeading || page.sections?.[0]?.heading || "",
    excerpt: primaryEvidence?.excerpt || page.text?.slice(0, 420) || ""
  };
  const allSupportingSources = [...(structured.sources || []), ...sources].filter((source) => source.url !== primarySource.url);
  const structuredSources = [primarySource, ...allSupportingSources.filter((source, index) => allSupportingSources.findIndex((item) => item.url === source.url) === index)];
  return {
    groundedAnswer,
    sources: structuredSources.length ? structuredSources : [{ title: page.title || title, url: page.canonicalUrl || page.url }],
    usefulLinks: usefulLinks.map(({ text, href, sectionHeading, sourcePageTitle }) => ({ text, href, sectionHeading, sourcePageTitle })),
    retrievalStatus: groundedAnswer.verified ? "verified" : "insufficient_content"
  };
}

export async function summarizeFauContent({ title = "FAU page", url = "", text }) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const sentences = normalizedText.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary = (sentences.slice(0, 2).join(" ") || normalizedText).slice(0, 360);
  const keyDetails = sentences.slice(2, 5).map((sentence) => sentence.slice(0, 220));

  return createJsonResponse({
    fallback: {
      summary,
      keyDetails,
      nextSteps: url
        ? ["Review the official source page for current requirements, dates, and contact details."]
        : ["Compare this summary with the original page text before acting on deadlines or requirements."],
      sentiment: "neutral"
    },
    system: "Summarize FAU website text for a student. Return only JSON with summary, keyDetails, nextSteps, and sentiment. sentiment must be positive, neutral, urgent, or confusing.",
    user: `Page title: ${title}\nURL: ${url || "Not provided"}\nText:\n${text}`
  });
}
