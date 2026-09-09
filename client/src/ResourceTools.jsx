import { useEffect, useRef, useState } from 'react';
import { AlertCircle, BookOpen, Bookmark, CheckCircle2, CalendarDays, ExternalLink, FileText, GraduationCap, Link2, Loader2, MapPin, Monitor, MoreVertical, Pin, Sparkles, Trash2, Users, X } from 'lucide-react';
import { validateSummaryInput } from './utils.js';
import { api } from './api.js';
function ResourceIcon({ resource, size = 20 }) {
  const text = `${resource?.category || ""} ${resource?.page_type || ""} ${resource?.title || ""}`.toLowerCase();
  const Icon = text.includes("calendar") ? CalendarDays : text.includes("catalog") ? BookOpen :
    text.includes("advis") || text.includes("career") ? Users : text.includes("canvas") || text.includes("technology") ? Monitor :
    text.includes("parking") || text.includes("map") ? MapPin : text.includes("degree") || text.includes("program") ? GraduationCap : FileText;
  return <Icon size={size} aria-hidden="true" />;
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
            <button type="button" onClick={() => onPin(resource)}>{pinned ? <CheckCircle2 size={14} /> : <Pin size={14} />}{pinned ? "Pinned" : "Pin link"}</button>
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
  const dialog = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, [open]);
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
      <dialog ref={dialog} className="summarizer-modal" onCancel={onClose} aria-labelledby="summarizer-title">
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


export { ResultCard, SavedSection, SummarizerModal };
