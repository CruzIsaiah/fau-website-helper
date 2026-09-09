import { useState } from "react";
import { answerPlainText, safeUrl } from "./answerPresentation.js";
import { Bookmark, CheckCircle2, Copy, ExternalLink, FileText, Loader2, Pin, MessageCircle } from "lucide-react";

export function CitedText({ children, sources = [] }) {
  return String(children || "").split(/(\[\d+\])/g).map((part, index) => {
    const citation = part.match(/^\[(\d+)\]$/);
    const source = citation ? sources[Number(citation[1]) - 1] : null;
    return source ? <a className="inline-citation" href={source.url} target="_blank" rel="noopener noreferrer" key={`${part}-${index}`}>{part}</a> : citation ? null : part.split(/(\*\*[^*]+\*\*)/g).map((text, i) => text.startsWith("**") ? <strong key={i}>{text.slice(2, -2)}</strong> : text);
  });
}

export function AnswerText({ answer, sources }) {
  return answer.summary ? String(answer.summary).split(/\n\s*\n/).map((paragraph, i) => <p className="answer-summary" key={i}><CitedText sources={sources}>{paragraph}</CitedText></p>) : null;
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
  return <><div className="answer-date"><CalendarMark /><p><CitedText sources={sources}>{answer.summary}</CitedText></p></div><AnswerFacts facts={answer.facts} sources={sources} /></>;
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
      <div className="answer-table-mobile">{table.rows.map((row, rowIndex) => <article key={`${row.join("-")}-${rowIndex}`}>{row.map((cell, cellIndex) => <div key={`${cell}-${cellIndex}`}><span>{table.headers[cellIndex]}</span><strong><CitedText sources={sources}>{table.headers[cellIndex]?.toLowerCase() === "credits" && cell ? `${cell} credits` : cell || "—"}</CitedText></strong></div>)}</article>)}</div>
    </section>)}
    {!expanded && totalRows > initialLimit && <button className="answer-show-all" type="button" onClick={() => setExpanded(true)}>Show all {totalRows} courses</button>}
  </div>;
}

export function AnswerRequirements({ answer, sources }) {
  const [allOpen, setAllOpen] = useState(false);
  const [version, setVersion] = useState(0);
  return <div className="requirements-layout"><div>
    {answer.tables?.length > 0 && <><div className="requirements-heading"><h3>Requirements by category</h3><button type="button" onClick={() => { setAllOpen(!allOpen); setVersion(v => v + 1); }}>{allOpen ? 'Collapse all' : 'Expand all'}</button></div>
      <div className="requirement-groups" key={version}>{answer.tables.map((table, index) => <details key={index} open={allOpen || (version === 0 && index === 0)}><summary>{table.heading || 'Course requirements'}</summary><AnswerTable answer={{ tables: [table], display: { showAll: true } }} sources={sources} /></details>)}</div></>}
    <AnswerList sections={answer.sections} sources={sources} />
  </div>{answer.facts?.length > 0 && <aside className="requirements-glance"><h3>At a glance</h3><AnswerFacts facts={answer.facts} sources={sources} /></aside>}</div>;
}

export function AnswerFacts({ facts, sources = [] }) {
  if (!facts?.length) return null;
  return <dl className="answer-facts">{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd><CitedText sources={sources}>{fact.value}</CitedText></dd></div>)}</dl>;
}

export function AnswerSource({ sources }) {
  if (!sources.length) return null;
  return <section className="answer-sources"><h3>Sources</h3><div>{sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"><FileText size={22} aria-hidden="true" /><b>{index + 1}</b><span>{source.title || new URL(source.url).hostname}<small>{new URL(source.url).hostname.replace(/^www\./, '')}</small></span><ExternalLink size={17} aria-hidden="true" /></a>)}</div></section>;
}

function AnswerBody({ answer, sources }) {
  if (answer.type === "date" || answer.type === "deadline") return <><AnswerDate answer={answer} sources={sources} /><AnswerList sections={answer.sections} sources={sources} /></>;
  if (answer.type === "steps") return <><AnswerText answer={answer} sources={sources} /><AnswerSteps steps={answer.steps} sources={sources} /><AnswerFacts facts={answer.facts} sources={sources} /><AnswerList sections={answer.sections} sources={sources} /></>;
  if (answer.type === "requirements") return <><AnswerText answer={answer} sources={sources} /><AnswerRequirements answer={answer} sources={sources} /></>;
  if (answer.type === "table") return <><AnswerText answer={answer} sources={sources} /><AnswerTable key={answer.title} answer={answer} sources={sources} /><AnswerList sections={answer.sections} sources={sources} /></>;
  if (answer.type === "list") return <><AnswerText answer={answer} sources={sources} /><AnswerList sections={answer.sections} sources={sources} /></>;
  if (answer.type === "short_fact") return <><AnswerText answer={answer} sources={sources} /><AnswerRequirements answer={answer} sources={sources} /></>;
  return <><AnswerText answer={answer} sources={sources} /><AnswerList sections={answer.sections} sources={sources} /><AnswerTable key={answer.title} answer={answer} sources={sources} /></>;
}

export default function AnswerPanel({ answer, sources = [], usefulLinks = [], activeResource, loading, saved, pinned, onSave, onPin }) {
  const [copyState, setCopyState] = useState('');
  const primaryUrl = sources[0]?.url || activeResource?.url;
  const links = usefulLinks.filter((link, i, all) => safeUrl(link.href) && all.findIndex(other => other.href === link.href) === i).slice(0, 3);
  async function copyAnswer() {
    try { await navigator.clipboard.writeText(answerPlainText(answer, sources)); setCopyState('Copied'); }
    catch { setCopyState('Copy unavailable. Select the answer text to copy it.'); }
  }
  return <div className="conversation-answer" aria-busy={loading}>
    <div className="assistant-label"><span><MessageCircle size={23} aria-hidden="true" /></span><strong>Campus Assistant</strong></div>
    {loading ? <div className="answer-loading" role="status"><Loader2 className="spin" size={22} /><strong>Reading official FAU sources…</strong><span>Your answer will appear here.</span></div> : !answer ? <div className="answer-empty"><p>I couldn’t find a sourced answer for that question. Try including a specific program, office, or campus location.</p></div> : <>
      <div className={`answer-content ${answer.verified ? 'verified' : 'unverified'}`}>
        {answer.title && <h2>{answer.title}</h2>}
        <AnswerBody answer={answer} sources={sources} />
        {answer.nextSteps?.length > 0 && <AnswerList sections={[{ heading: 'Next steps', items: answer.nextSteps }]} sources={sources} />}
        {(primaryUrl || links.length > 0) && <div className="answer-destinations">{safeUrl(primaryUrl) && <a className="primary-link" href={primaryUrl} target="_blank" rel="noopener noreferrer">View official source <ExternalLink size={16} /></a>}{links.filter(link => link.href !== primaryUrl).map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.text || new URL(link.href).hostname}<ExternalLink size={15} /></a>)}</div>}
      </div>
      <AnswerSource sources={sources} />
      <div className="answer-toolbar"><button type="button" onClick={copyAnswer}><Copy size={18} />{copyState === 'Copied' ? 'Copied' : 'Copy answer'}</button>{activeResource && <><button type="button" onClick={() => onSave(activeResource)}>{saved ? <CheckCircle2 size={17} /> : <Bookmark size={17} />}{saved ? 'Saved' : 'Save source'}</button><button type="button" onClick={() => onPin(activeResource)}><Pin size={17} />{pinned ? 'Unpin source' : 'Pin source'}</button></>}<span role="status">{copyState && copyState !== 'Copied' ? copyState : ''}</span></div>
    </>}
  </div>;
}
