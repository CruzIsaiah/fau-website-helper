import { useState } from "react";
import { Bookmark, CheckCircle2, ExternalLink, FileText, Loader2, Pin, Sparkles } from "lucide-react";

function CitedText({ children, sources }) {
  return String(children || "").split(/(\[\d+\])/g).map((part, index) => {
    const citation = part.match(/^\[(\d+)\]$/);
    const source = citation ? sources[Number(citation[1]) - 1] : null;
    return source ? <a className="inline-citation" href={source.url} target="_blank" rel="noopener noreferrer" key={`${part}-${index}`}>{part}</a> : part;
  });
}

export function AnswerText({ answer, sources }) {
  return answer.summary ? <p className="answer-summary"><CitedText sources={sources}>{answer.summary}</CitedText></p> : null;
}

export function AnswerList({ sections, sources }) {
  if (!sections?.length) return null;
  return sections.map((section, sectionIndex) => (
    <section className="answer-list" key={`${section.heading}-${sectionIndex}`}>
      <h4>{section.heading}</h4>
      <ul>{(section.items || []).map((item, itemIndex) => <li key={`${item}-${itemIndex}`}><CitedText sources={sources}>{item}</CitedText></li>)}</ul>
    </section>
  ));
}

export function AnswerDate({ answer, sources }) {
  return <><div className="answer-date"><CalendarMark /><p><CitedText sources={sources}>{answer.summary}</CitedText></p></div><AnswerFacts facts={answer.facts} /></>;
}

function CalendarMark() {
  return <span aria-hidden="true">Date</span>;
}

export function AnswerSteps({ steps, sources }) {
  if (!steps?.length) return null;
  return <ol className="answer-steps">{steps.map((step, index) => <li key={`${step}-${index}`}><span>{index + 1}</span><p><CitedText sources={sources}>{step}</CitedText></p></li>)}</ol>;
}

function visibleTables(tables, limit) {
  let remaining = limit;
  return (tables || []).map((table) => {
    const normalizedRows = table.courses?.length
      ? table.courses.map((course) => [course.code, course.title, String(course.credits ?? "")])
      : table.rows || [];
    const rows = remaining > 0 ? normalizedRows.slice(0, remaining) : [];
    remaining -= rows.length;
    return { ...table, rows };
  }).filter((table) => table.rows.length);
}

export function AnswerTable({ answer, sources }) {
  const totalRows = (answer.tables || []).reduce((total, table) => total + (table.courses?.length || table.rows?.length || 0), 0);
  const initialLimit = answer.display?.showAll ? totalRows : answer.display?.initialRowLimit || Math.min(10, totalRows);
  const [expanded, setExpanded] = useState(Boolean(answer.display?.showAll));
  const tables = visibleTables(answer.tables, expanded ? totalRows : initialLimit);
  if (!tables.length) return null;
  return <div className="answer-tables">
    {tables.map((table, tableIndex) => <section className="answer-table-section" key={`${table.heading}-${tableIndex}`}>
      {table.heading && <h4>{table.heading}</h4>}
      <div className="answer-table-desktop"><table><colgroup>{table.headers.map((header) => <col className={`answer-col-${header.toLowerCase()}`} key={header} />)}</colgroup><thead><tr>{table.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{table.rows.map((row, rowIndex) => <tr key={`${row.join("-")}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}><CitedText sources={sources}>{cell}</CitedText></td>)}</tr>)}</tbody></table></div>
      <div className="answer-table-mobile">{table.rows.map((row, rowIndex) => <article key={`${row.join("-")}-${rowIndex}`}>{row.map((cell, cellIndex) => <div key={`${cell}-${cellIndex}`}><span>{table.headers[cellIndex]}</span><strong>{table.headers[cellIndex]?.toLowerCase() === "credits" && cell ? `${cell} credits` : cell || "—"}</strong></div>)}</article>)}</div>
    </section>)}
    {!expanded && totalRows > initialLimit && <button className="answer-show-all" type="button" onClick={() => setExpanded(true)}>Show all {totalRows} courses</button>}
  </div>;
}

export function AnswerRequirements({ answer, sources }) {
  return <>
    <AnswerFacts facts={answer.facts} />
    <AnswerTable key={answer.title} answer={answer} sources={sources} />
    <AnswerList sections={answer.sections} sources={sources} />
  </>;
}

export function AnswerFacts({ facts }) {
  if (!facts?.length) return null;
  return <dl className="answer-facts">{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>;
}

export function AnswerSource({ sources }) {
  if (!sources.length) return null;
  return <section className="answer-sources"><h4>Source{sources.length > 1 ? "s" : ""}</h4><div>{sources.slice(0, 3).map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"><span>{sources.length > 1 ? `[${index + 1}] ` : ""}{source.title}</span><ExternalLink size={13} /></a>)}</div></section>;
}

function AnswerBody({ answer, sources }) {
  if (answer.type === "date" || answer.type === "deadline") return <><AnswerDate answer={answer} sources={sources} /><AnswerList sections={answer.sections} sources={sources} /></>;
  if (answer.type === "steps") return <><AnswerText answer={answer} sources={sources} /><AnswerSteps steps={answer.steps} sources={sources} /><AnswerFacts facts={answer.facts} /><AnswerList sections={answer.sections} sources={sources} /></>;
  if (answer.type === "requirements") return <><AnswerText answer={answer} sources={sources} /><AnswerRequirements answer={answer} sources={sources} /></>;
  if (answer.type === "table") return <><AnswerText answer={answer} sources={sources} /><AnswerTable key={answer.title} answer={answer} sources={sources} /><AnswerList sections={answer.sections} sources={sources} /></>;
  if (answer.type === "list") return <><AnswerText answer={answer} sources={sources} /><AnswerList sections={answer.sections} sources={sources} /></>;
  if (answer.type === "short_fact") return <><AnswerText answer={answer} sources={sources} /><AnswerRequirements answer={answer} sources={sources} /></>;
  return <><AnswerText answer={answer} sources={sources} /><AnswerList sections={answer.sections} sources={sources} /><AnswerTable key={answer.title} answer={answer} sources={sources} /></>;
}

export default function AnswerPanel({ answer, sources, usefulLinks, activeResource, loading, saved, pinned, onSave, onPin }) {
  const primaryUrl = sources[0]?.url || activeResource?.url;
  return (
    <aside className="answer-column" aria-live="polite">
      <div className="answer-panel-heading"><FileText size={22} /><h2>Answer From FAU Sources</h2></div>
      {loading ? (
        <div className="answer-loading"><Loader2 className="spin" size={20} /><strong>Reading official FAU sources...</strong><span>Finding the most relevant sections for your question.</span></div>
      ) : !answer ? (
        <div className="answer-empty"><Sparkles size={24} /><p>Ask a question or summarize an FAU resource to see a sourced answer.</p></div>
      ) : (
        <div className={`answer-content ${answer.verified ? "verified" : "unverified"}`}>
          <h3>{answer.title}</h3>
          <AnswerBody answer={answer} sources={sources} />
          {answer.type === "summary" && usefulLinks.length > 0 && <section><h4>Useful Links</h4><div className="answer-useful-links">{usefulLinks.slice(0, 4).map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.text} <ExternalLink size={12} /></a>)}</div></section>}
          <AnswerSource sources={sources} />
          {activeResource && <div className="answer-actions"><a href={primaryUrl} target="_blank" rel="noopener noreferrer">Open Official Source <ExternalLink size={14} /></a><button type="button" onClick={() => onSave(activeResource)}>{saved ? <CheckCircle2 size={15} /> : <Bookmark size={15} />}{saved ? "Saved" : "Save"}</button><button className="icon-action" type="button" onClick={() => onPin(activeResource)} aria-label={`${pinned ? "Unpin" : "Pin"} ${activeResource.title}`} title={pinned ? "Pinned" : "Pin to sidebar"}><Pin size={16} /></button></div>}
        </div>
      )}
    </aside>
  );
}
