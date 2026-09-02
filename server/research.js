import { fetchFauPage } from "./pageReader.js";
import { analyzeQuery, normalizeText } from "./search.js";

const BOILERPLATE_HEADINGS = /contact us|related links|quick links|news|events|navigation|footer|directions|social media/i;

function tokens(value) {
  return normalizeText(value).split(" ").filter((token) => token.length > 2);
}

function sectionText(section) {
  return [
    ...section.paragraphs,
    ...section.lists.flatMap((list) => list.items),
    ...section.definitions.flatMap((entry) => [`${entry.term}: ${entry.definition}`]),
    ...section.tables.flatMap((table) => [table.headers.join(" | "), ...table.rows.map((row) => row.join(" | "))])
  ].filter(Boolean).join("\n");
}

function lexicalScore(queryTerms, value) {
  const haystack = normalizeText(value);
  const haystackTokens = new Set(tokens(haystack));
  return queryTerms.reduce((score, term) => score + (haystackTokens.has(term) ? 1 : haystack.includes(term) ? 0.35 : 0), 0);
}

function supportingLinkBoost(link) {
  const value = normalizeText(`${link.text} ${link.href} ${link.sectionHeading} ${link.surroundingContext}`);
  if (/program summary/.test(value)) return 6;
  if (/curriculum|flowchart/.test(value)) return 5;
  if (/degree requirements|required courses|course list/.test(value)) return 4;
  if (/university catalog|catalog/.test(value)) return 2;
  if (/course description/.test(value)) return 1;
  return 0;
}

export function rankPageChunks(question, pages, limit = 10) {
  const analysis = analyzeQuery(question);
  const queryTerms = [...new Set([...analysis.queryTokens, ...analysis.expandedTerms])];
  return pages.flatMap((page) => page.sections.map((section, sectionIndex) => {
    const content = sectionText(section);
    const headingScore = lexicalScore(queryTerms, section.heading) * 2.8;
    const bodyScore = lexicalScore(queryTerms, content) * 0.7;
    const phraseScore = analysis.matchedConcepts.reduce((score, concept) => score + (normalizeText(`${section.heading} ${content}`).includes(concept) ? 2.2 : 0), 0);
    const queryRelevance = headingScore + bodyScore + phraseScore;
    const tableBoost = section.tables.length > 0 && analysis.intents.some((intent) => ["program_requirements", "courses", "billing", "deadlines"].includes(intent)) ? 1.5 : 0;
    const listBoost = section.lists.length > 0 ? 0.55 : 0;
    const sourceRankBoost = (page.retrievalWeight || 0) * 3;
    const boilerplatePenalty = BOILERPLATE_HEADINGS.test(section.heading) ? 4 : 0;
    const qualifierPenalty = /\bsecond\b/i.test(section.heading) && !/\bsecond\b/i.test(analysis.normalizedQuery) ? 9 : 0;
    return {
      pageUrl: page.canonicalUrl || page.url,
      pageTitle: page.title,
      sectionHeading: section.heading,
      sectionIndex,
      text: content.slice(0, 5000),
      paragraphs: section.paragraphs,
      lists: section.lists,
      definitions: section.definitions,
      tables: section.tables,
      queryRelevance: Number(queryRelevance.toFixed(3)),
      score: Number(Math.max(0, headingScore + bodyScore + phraseScore + tableBoost + listBoost + sourceRankBoost - boilerplatePenalty - qualifierPenalty).toFixed(3))
    };
  }))
    .filter((chunk) => chunk.text.length >= 20 && chunk.queryRelevance >= 0.7 && chunk.score >= 0.7)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function shouldAvoidLink(link, analysis) {
  const value = normalizeText(`${link.text} ${link.href}`);
  if (/login|logout|search|give|donate|news|faculty directory|social|precat/.test(value)) return true;
  if (/calendar/.test(value) && !analysis.intents.some((intent) => ["deadlines", "registration", "withdrawal", "graduation"].includes(intent))) return true;
  return /\.(jpg|jpeg|png|gif|zip|docx?|xlsx?|pptx?)($|\?)/i.test(link.href);
}

function normalizedDegree(value = "") {
  const degree = normalizeText(value).replace(/bachelor of /g, "b");
  if (/\bb\s+s\b|\bbs\b|\bbscs\b|bachelor of science/.test(degree)) return "bs";
  if (/\bb\s+a\b|\bba\b|\bbacs\b|bachelor of arts/.test(degree)) return "ba";
  return degree;
}

function allowsDegreeComparison(question) {
  return /\bcompare\b|\bdifference between\b|\bversus\b|\bvs\.?\b/i.test(question);
}

function compatibleResource(resource, anchorResource, question) {
  if (!anchorResource || allowsDegreeComparison(question)) return true;
  if (anchorResource.program && resource.program && normalizeText(anchorResource.program) !== normalizeText(resource.program)) return false;
  const anchorDegree = normalizedDegree(anchorResource.degree);
  const resourceDegree = normalizedDegree(resource.degree);
  return !anchorDegree || !resourceDegree || anchorDegree === resourceDegree;
}

function compatibleLink(link, anchorResource, question) {
  if (!anchorResource || allowsDegreeComparison(question)) return true;
  const degree = normalizedDegree(anchorResource.degree);
  const value = normalizeText(`${link.text} ${link.href} ${link.surroundingContext}`);
  if (degree === "bs") return !/computer science ba|bachelor of arts|\bbacs\b|computer-science-ba/.test(value);
  if (degree === "ba") return !/computer science bs|bachelor of science|\bbscs\b|degree requirements bscs|program sumary bscs/.test(value);
  return true;
}

export function rankPageLinks(question, pages, limit = 12) {
  const analysis = analyzeQuery(question);
  const queryTerms = [...new Set([...analysis.queryTokens, ...analysis.expandedTerms])];
  const seen = new Set();
  return pages.flatMap((page) => page.links.map((link) => {
    const score = lexicalScore(queryTerms, link.text) * 3.2 +
      lexicalScore(queryTerms, link.sectionHeading) * 1.8 +
      lexicalScore(queryTerms, link.surroundingContext) * 0.65 +
      lexicalScore(queryTerms, link.href) * 0.45 +
      analysis.matchedConcepts.reduce((total, concept) => total + (normalizeText(`${link.text} ${link.sectionHeading}`).includes(concept) ? 1.8 : 0), 0) +
      supportingLinkBoost(link) +
      (page.retrievalWeight || 0) * 2.5 -
      (/^https?:\/\//i.test(link.text) ? 3 : 0);
    return { ...link, sourcePageTitle: page.title, sourcePageUrl: page.canonicalUrl || page.url, score: Number(score.toFixed(3)) };
  }))
    .filter((link) => {
      if (link.href === link.sourcePageUrl || link.score < 1.4 || shouldAvoidLink(link, analysis) || seen.has(link.href)) return false;
      seen.add(link.href);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function retrieveFauContent({ question, matches, resources, pageFetcher = fetchFauPage, maxInitialPages = 2, maxFollowPages = 3, bypassCache = false, anchorResource }) {
  const initialResources = matches.slice(0, maxInitialPages)
    .map((match) => resources.find((resource) => resource.id === match.resourceId))
    .filter((resource) => resource && compatibleResource(resource, anchorResource, question));
  const fetched = [];
  const rejected = [];
  const seenUrls = new Set(initialResources.map((resource) => resource.url));

  const initialResults = await Promise.allSettled(initialResources.map((resource) => pageFetcher(resource.url, { bypassCache })));
  initialResults.forEach((result, index) => {
    const resource = initialResources[index];
    if (result.status === "fulfilled") fetched.push({ ...result.value, resourceId: resource.id, retrievalWeight: index === 0 ? 3 : 1 });
    else rejected.push({ url: resource.url, resourceId: resource.id, error: result.reason?.message || "Fetch failed" });
  });

  const discoveryLinks = rankPageLinks(question, fetched, 16)
    .filter((link) => !seenUrls.has(link.href) && link.score >= 4 && !/\.pdf($|\?)/i.test(link.href) && compatibleLink(link, anchorResource, question))
    .slice(0, maxFollowPages);
  discoveryLinks.forEach((link) => seenUrls.add(link.href));
  const followResults = await Promise.allSettled(discoveryLinks.map((link) => pageFetcher(link.href, { bypassCache })));
  followResults.forEach((result, index) => {
    const link = discoveryLinks[index];
    if (result.status === "fulfilled") fetched.push({ ...result.value, discoveredFrom: link.sourcePageUrl, retrievalWeight: 0.4 });
    else rejected.push({ url: link.href, discoveredFrom: link.sourcePageUrl, error: result.reason?.message || "Fetch failed" });
  });

  const chunks = rankPageChunks(question, fetched, 10);
  const usefulLinks = rankPageLinks(question, fetched, 10);
  const sourceUrls = new Set();
  const sources = chunks.map((chunk) => {
    if (sourceUrls.has(chunk.pageUrl)) return null;
    sourceUrls.add(chunk.pageUrl);
    return {
      title: chunk.pageTitle,
      url: chunk.pageUrl,
      sectionHeading: chunk.sectionHeading,
      excerpt: chunk.text.slice(0, 420)
    };
  }).filter(Boolean).slice(0, 5);

  const debug = {
    pagesFetched: fetched.map((page) => ({ url: page.url, canonicalUrl: page.canonicalUrl, httpStatus: page.httpStatus, cache: page.cache, sections: page.sections.length, links: page.links.length })),
    pagesRejected: rejected,
    linksConsidered: fetched.reduce((total, page) => total + page.links.length, 0),
    discoveryLinks,
    chunksRanked: chunks.map((chunk) => ({ pageUrl: chunk.pageUrl, sectionHeading: chunk.sectionHeading, score: chunk.score })),
    contextCharacters: chunks.reduce((total, chunk) => total + chunk.text.length, 0)
  };
  if (process.env.SEARCH_DEBUG === "true" && process.env.NODE_ENV !== "production") console.debug("[research-debug]", JSON.stringify({ question, ...debug }, null, 2));
  return { pages: fetched, rejected, chunks, usefulLinks, sources, debug };
}
