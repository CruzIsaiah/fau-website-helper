import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, BookOpen, Bookmark, CalendarDays, CheckCircle2,
  Compass, ExternalLink, FileText, GraduationCap, Link2, Loader2, MapPin, Menu, Monitor,
  MoreVertical, Pencil, Pin, Search, Sparkles, Trash2, Users, X
} from "lucide-react";
import { createRoot } from "react-dom/client";
import AnswerPanel from "./AnswerPanel.jsx";
import {
  createPinnedLink, createSavedItem, parsePinnedLinks, parseSavedLinks, validateSummaryInput
} from "./utils.js";
import "./styles.css";

const API = "/api";
const SAVED_LINKS_KEY = "fau-helper-saved";
const PINNED_LINKS_KEY = "fau-helper-pinned";
const SEARCH_SUGGESTIONS = ["CS degree requirements", "Add/Drop", "Financial Aid", "Parking", "Academic Calendar"];

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : { error: "The server returned an unexpected response." };
  if (!response.ok) {
    const error = new Error(data.error || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function ResourceIcon({ resource, size = 20 }) {
  const text = `${resource?.category || ""} ${resource?.page_type || ""} ${resource?.title || ""}`.toLowerCase();
  const Icon = text.includes("calendar") ? CalendarDays : text.includes("catalog") ? BookOpen :
    text.includes("advis") || text.includes("career") ? Users : text.includes("canvas") || text.includes("technology") ? Monitor :
    text.includes("parking") || text.includes("map") ? MapPin : text.includes("degree") || text.includes("program") ? GraduationCap : FileText;
  return <Icon size={size} aria-hidden="true" />;
}

function Header({ onMenu }) {
  return (
    <header className="app-header">
      <button className="mobile-menu" type="button" onClick={onMenu} aria-label="Open quick links"><Menu size={20} /></button>
      <a className="brand" href="#top" aria-label="FAU Website Helper home">
        <span className="brand-mark"><Compass size={22} aria-hidden="true" /></span>
        <span><strong>FAU Website Helper</strong><small>Independent FAU navigation assistant</small></span>
      </a>
    </header>
  );
}

function Sidebar({ resources, pinned, open, onClose, onRename, onUnpin, onOpenSummarizer }) {
  const [editingId, setEditingId] = useState("");
  const [draftName, setDraftName] = useState("");
  const quickLinks = [
    ["academic-calendar", "Academic Calendar"], ["university-catalog", "Course Catalog"],
    ["registrar", "Registrar"], ["canvas", "Canvas"]
  ].map(([id, label]) => ({ resource: resources.find((item) => item.id === id), label })).filter((item) => item.resource);

  function beginRename(item) {
    setEditingId(item.id);
    setDraftName(item.displayName);
  }

  function saveRename(event, item) {
    event.preventDefault();
    const cleanName = draftName.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!cleanName) return;
    onRename(item.id, cleanName);
    setEditingId("");
  }

  return (
    <>
      {open && <button className="sidebar-scrim" type="button" onClick={onClose} aria-label="Close quick links" />}
      <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Quick access sidebar">
        <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close quick links"><X size={19} /></button>
        <section>
          <h2>Quick Links</h2>
          <div className="sidebar-links">
            {quickLinks.map(({ resource, label }) => (
              <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer"><ResourceIcon resource={resource} size={17} /><span>{label}</span></a>
            ))}
            <button type="button" onClick={onOpenSummarizer}><FileText size={17} /><span>Page Summarizer</span></button>
          </div>
        </section>
        <div className="sidebar-rule" />
        <section className="pinned-section">
          <div className="sidebar-heading-row"><div><h2><Pin size={15} /> Pinned Links</h2><p>Your shortcuts</p></div></div>
          {pinned.length === 0 ? <p className="sidebar-empty">No pinned links yet. Pin useful FAU pages for quick access.</p> : (
            <div className="pinned-list">
              {pinned.map((item) => editingId === item.id ? (
                <form className="pin-rename-form" key={item.id} onSubmit={(event) => saveRename(event, item)}>
                  <label htmlFor={`rename-${item.id}`}>Rename pinned link</label>
                  <input id={`rename-${item.id}`} value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={80} autoFocus />
                  <div><button type="button" onClick={() => setEditingId("")}>Cancel</button><button className="pin-save-name" type="submit">Save</button></div>
                </form>
              ) : (
                <div className="pinned-item" key={item.id}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.originalTitle}><Pin size={15} /><span>{item.displayName}</span></a>
                  <details className="item-menu">
                    <summary aria-label={`Actions for ${item.displayName}`}><MoreVertical size={17} /></summary>
                    <div>
                      <button type="button" onClick={() => beginRename(item)} aria-label={`Rename ${item.displayName}`}><Pencil size={14} /> Rename</button>
                      <button type="button" onClick={() => onUnpin(item)} aria-label={`Unpin ${item.displayName}`}><Trash2 size={14} /> Unpin</button>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </section>
        <p className="sidebar-disclaimer">Independent project.<br />Not affiliated with or endorsed by Florida Atlantic University.</p>
      </aside>
    </>
  );
}

function SearchHero({ question, setQuestion, onSearch, loading }) {
  function submit(event) {
    event.preventDefault();
    onSearch(question);
  }
  return (
    <section className="search-hero" id="top">
      <h1>Find the right FAU resources. Fast.</h1>
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="resource-search">Ask anything about FAU</label>
        <div className="hero-search-control">
          <Search size={25} aria-hidden="true" />
          <input id="resource-search" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask anything about FAU..." maxLength={600} />
          <button type="submit" disabled={loading}>{loading ? <Loader2 className="spin" size={18} /> : null}{loading ? "Searching..." : "Find Resources"}</button>
        </div>
      </form>
      <div className="hero-suggestions"><span>Try:</span>{SEARCH_SUGGESTIONS.map((item) => <button type="button" key={item} onClick={() => onSearch(item)} disabled={loading}>{item}</button>)}</div>
    </section>
  );
}

function ResultCard({ resource, match, best, saved, pinned, reading, onSummarize, onSave, onPin }) {
  return (
    <article className={`result-card ${best ? "best-result" : ""}`}>
      <span className="result-icon"><ResourceIcon resource={resource} size={23} /></span>
      <div className="result-copy">
        <div className="result-title-row"><h3>{resource.title}</h3>{best && <span>Best Match</span>}</div>
        <p>{resource.description}</p>
        <div className="result-meta"><span>{resource.department || "Florida Atlantic University"}</span>{resource.page_type && <span>{resource.page_type.replaceAll("_", " ")}</span>}</div>
      </div>
      <div className="result-actions">
        <a href={resource.url} target="_blank" rel="noopener noreferrer">Open Page <ExternalLink size={14} /></a>
        <button className="summarize-result" type="button" onClick={() => onSummarize(resource)} disabled={reading}>{reading ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}{reading ? "Reading..." : "Summarize"}</button>
        <details className="item-menu result-menu">
          <summary aria-label={`More actions for ${resource.title}`}><MoreVertical size={18} /></summary>
          <div>
            <button type="button" onClick={() => onSave(resource)}>{saved ? <CheckCircle2 size={14} /> : <Bookmark size={14} />}{saved ? "Saved" : "Save"}</button>
            <button type="button" onClick={() => onPin(resource)}>{pinned ? <CheckCircle2 size={14} /> : <Pin size={14} />}{pinned ? "Pinned" : "Pin to sidebar"}</button>
          </div>
        </details>
      </div>
      {match?.reason && <span className="sr-only">{match.reason}</span>}
    </article>
  );
}

function SavedSection({ saved, onRemove, onPin, pinnedUrls }) {
  return (
    <section className="saved-section" id="saved">
      <div><p className="section-kicker">Saved for later</p><h2>Saved Links</h2></div>
      {saved.length === 0 ? <p className="saved-empty">No saved resources yet.</p> : <div className="saved-list">{saved.map((item) => <article key={item.id}><div><span>{item.category}</span><h3>{item.title}</h3></div><div><a href={item.url} target="_blank" rel="noopener noreferrer">Open <ExternalLink size={13} /></a><button type="button" onClick={() => onPin(item)} disabled={pinnedUrls.has(item.url)}><Pin size={14} />{pinnedUrls.has(item.url) ? "Pinned" : "Pin"}</button><button type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item.title} from saved links`}><Trash2 size={14} /> Remove</button></div></article>)}</div>}
    </section>
  );
}

function SummarizerModal({ open, onClose }) {
  const [form, setForm] = useState({ url: "", text: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    const validationError = validateSummaryInput(form.url.trim(), form.text.trim());
    if (validationError) return setError(validationError);
    setError(""); setResult(null); setLoading(true);
    try {
      setResult(await api("/ai/summarize", { method: "POST", body: JSON.stringify({ url: form.url.trim(), text: form.text.trim() }) }));
    } catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <dialog className="summarizer-modal" open aria-labelledby="summarizer-title">
        <div className="modal-heading"><div><p>Manual tool</p><h2 id="summarizer-title">Page Summarizer</h2></div><button type="button" onClick={onClose} aria-label="Close page summarizer"><X size={20} /></button></div>
        <p>Paste an official FAU URL or page text to create a short summary.</p>
        <form onSubmit={submit}>
          <label htmlFor="summary-url">FAU page URL</label><div className="modal-input"><Link2 size={16} /><input id="summary-url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://www.fau.edu/registrar/" /></div>
          <label htmlFor="summary-text">Or paste page text</label><textarea id="summary-text" value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} maxLength={6000} />
          {error && <p className="modal-error" role="alert"><AlertCircle size={15} /> {error}</p>}
          <button className="modal-submit" type="submit" disabled={loading}>{loading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}{loading ? "Summarizing..." : "Summarize page"}</button>
        </form>
        {result && <div className="modal-result"><h3>Summary</h3><p>{result.summary}</p>{result.keyDetails?.length > 0 && <ul>{result.keyDetails.map((item) => <li key={item}>{item}</li>)}</ul>}</div>}
      </dialog>
    </div>
  );
}

function App() {
  const [resources, setResources] = useState([]);
  const [saved, setSaved] = useState(() => parseSavedLinks(localStorage.getItem(SAVED_LINKS_KEY)));
  const [pinned, setPinned] = useState(() => parsePinnedLinks(localStorage.getItem(PINNED_LINKS_KEY)));
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [matches, setMatches] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [usefulLinks, setUsefulLinks] = useState([]);
  const [activeResource, setActiveResource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [readingId, setReadingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summarizerOpen, setSummarizerOpen] = useState(false);
  const requestController = useRef(null);

  const savedUrls = useMemo(() => new Set(saved.map((item) => item.url)), [saved]);
  const pinnedUrls = useMemo(() => new Set(pinned.map((item) => item.url)), [pinned]);
  const displayedResults = useMemo(() => {
    if (!submittedQuestion) return resources.slice(0, 6).map((resource) => ({ resource }));
    return matches.map((match) => ({ match, resource: resources.find((resource) => resource.id === match.resourceId) })).filter((item) => item.resource);
  }, [matches, resources, submittedQuestion]);

  useEffect(() => {
    api("/resources").then((data) => setResources(Array.isArray(data.resources) ? data.resources : [])).catch((loadError) => setError(loadError.message));
  }, []);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(""), 2600); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => () => requestController.current?.abort(), []);

  function updateSaved(resource) {
    const exists = savedUrls.has(resource.url);
    const next = exists ? saved.filter((item) => item.url !== resource.url) : [createSavedItem(resource), ...saved];
    setSaved(next); persist(SAVED_LINKS_KEY, next); setNotice(exists ? "Removed from Saved." : "Saved for later.");
  }

  function updatePinned(resource) {
    const existing = pinned.find((item) => item.url === resource.url);
    const next = existing ? pinned.filter((item) => item.url !== resource.url) : [createPinnedLink(resource), ...pinned];
    setPinned(next); persist(PINNED_LINKS_KEY, next); setNotice(existing ? "Removed from Pinned Links." : "Pinned to the sidebar.");
  }

  function renamePinned(id, displayName) {
    const next = pinned.map((item) => item.id === id ? { ...item, displayName } : item);
    setPinned(next); persist(PINNED_LINKS_KEY, next); setNotice("Pinned link renamed.");
  }

  async function runSearch(rawQuestion) {
    const cleanQuestion = rawQuestion.trim().replace(/\s+/g, " ");
    setQuestion(cleanQuestion);
    if (cleanQuestion.length < 3) return setError("Ask a question using at least three characters.");
    requestController.current?.abort(); requestController.current = new AbortController();
    setSubmittedQuestion(cleanQuestion); setMatches([]); setAnswer(null); setSources([]); setUsefulLinks([]); setActiveResource(null); setError(""); setLoading(true);
    try {
      const found = await api("/ai/find", { method: "POST", signal: requestController.current.signal, body: JSON.stringify({ question: cleanQuestion }) });
      const nextMatches = Array.isArray(found.matches) ? found.matches : [];
      setMatches(nextMatches); setLoading(false); setAnswerLoading(nextMatches.length > 0);
      const top = resources.find((resource) => resource.id === nextMatches[0]?.resourceId);
      setActiveResource(top || null);
      if (nextMatches.length === 0) return;
      const research = await api("/ai/research", { method: "POST", signal: requestController.current.signal, body: JSON.stringify({ question: cleanQuestion }) });
      setAnswer(research.groundedAnswer || null); setSources(research.sources || []); setUsefulLinks(research.usefulLinks || []);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message);
    } finally { setLoading(false); setAnswerLoading(false); }
  }

  async function summarizeResource(resource) {
    setActiveResource(resource); setReadingId(resource.id); setAnswerLoading(true); setError("");
    try {
      const result = await api("/ai/summarize-resource", { method: "POST", body: JSON.stringify({
        url: resource.url,
        title: resource.title,
        program: resource.program,
        degree: resource.degree,
        originalQuery: submittedQuestion || resource.title
      }) });
      setAnswer(result.groundedAnswer || null); setSources(result.sources || []); setUsefulLinks(result.usefulLinks || []);
    } catch (requestError) { setError(requestError.message); } finally { setReadingId(""); setAnswerLoading(false); }
  }

  return (
    <div className="app-shell">
      <Header onMenu={() => setSidebarOpen(true)} />
      <div className="app-body">
        <Sidebar resources={resources} pinned={pinned} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onRename={renamePinned} onUnpin={updatePinned} onOpenSummarizer={() => { setSummarizerOpen(true); setSidebarOpen(false); }} />
        <main className="main-content">
          <SearchHero question={question} setQuestion={setQuestion} onSearch={runSearch} loading={loading} />
          {error && <div className="page-error" role="alert"><AlertCircle size={17} />{error}</div>}
          <div className="search-workspace">
            <section className="results-column" aria-busy={loading}>
              <div className="results-heading"><div><h2>{submittedQuestion ? <>Results for “{submittedQuestion}”</> : "Popular FAU resources"}</h2><p>{loading ? "Searching current FAU resources..." : `${displayedResults.length} ${displayedResults.length === 1 ? "result" : "results"}`}</p></div></div>
              {loading && displayedResults.length === 0 ? <div className="result-list">{[1, 2, 3, 4].map((item) => <div className="result-skeleton" key={item} />)}</div> : displayedResults.length > 0 ? (
                <div className="result-list">{displayedResults.map(({ resource, match }, index) => <ResultCard key={resource.id} resource={resource} match={match} best={Boolean(submittedQuestion && index === 0)} saved={savedUrls.has(resource.url)} pinned={pinnedUrls.has(resource.url)} reading={readingId === resource.id} onSummarize={summarizeResource} onSave={updateSaved} onPin={updatePinned} />)}</div>
              ) : <div className="no-results"><Search size={23} /><h3>No exact match found</h3><p>Try “Academic Calendar,” “Financial Aid,” or another specific FAU task.</p></div>}
            </section>
            <AnswerPanel answer={answer} sources={sources} usefulLinks={usefulLinks} activeResource={activeResource} loading={answerLoading} saved={activeResource ? savedUrls.has(activeResource.url) : false} pinned={activeResource ? pinnedUrls.has(activeResource.url) : false} onSave={updateSaved} onPin={updatePinned} />
          </div>
          <SavedSection saved={saved} onRemove={updateSaved} onPin={updatePinned} pinnedUrls={pinnedUrls} />
        </main>
      </div>
      <SummarizerModal open={summarizerOpen} onClose={() => setSummarizerOpen(false)} />
      <div className={`toast ${notice ? "visible" : ""}`} role="status"><CheckCircle2 size={16} />{notice}</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
