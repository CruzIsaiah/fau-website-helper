import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = "/api";

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function ResourceCard({ resource, match, onSave }) {
  const confidence =
    typeof match?.confidence === "number" ? match.confidence.toFixed(2) : match?.confidence;

  return (
    <article className="resource-card">
      <div>
        <span>{resource.category}</span>
        <h3>{resource.title}</h3>
        <p>{match?.reason || resource.description}</p>
        {confidence && <small>AI confidence: {confidence}</small>}
      </div>
      <div className="card-actions">
        <a href={resource.url} target="_blank" rel="noreferrer" title="Open official FAU page">
          <ExternalLink size={17} />
        </a>
        <button title="Save resource" onClick={() => onSave(resource, match?.reason || "")}>
          <Plus size={17} />
        </button>
      </div>
    </article>
  );
}

function Finder({ resources, onSave }) {
  const [question, setQuestion] = useState("");
  const [matches, setMatches] = useState([]);
  const [answer, setAnswer] = useState("");
  const [retrieved, setRetrieved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const matchedResources = useMemo(() => {
    if (matches.length === 0) return resources.slice(0, 6).map((resource) => ({ resource }));
    return matches
      .map((match) => ({ match, resource: resources.find((resource) => resource.id === match.resourceId) }))
      .filter((item) => item.resource);
  }, [matches, resources]);

  async function findPages(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setRetrieved([]);

    try {
      const data = await api("/ai/find", {
        method: "POST",
        body: JSON.stringify({ question })
      });
      setAnswer(data.answer || "");
      setMatches(data.matches || []);
      // Attempt to fetch retrieval-level sources (vector index) for richer excerpts
      try {
        const r = await api("/ai/retrieve", {
          method: "POST",
          body: JSON.stringify({ question, topK: 5 })
        });
        setRetrieved(r.results || []);
      } catch (err) {
        // ignore retrieval errors — we still show resource-level matches
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="finder">
      <form onSubmit={findPages} className="search-box">
        <label>
          What are you trying to find?
          <div className="search-row">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Example: I need to withdraw from a class"
              required
            />
            <button className="primary" disabled={loading || question.length < 3}>
              {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
              Find
            </button>
          </div>
        </label>
        {error && <p className="error">{error}</p>}
      </form>

      {answer && <p className="ai-answer">{answer}</p>}

      {retrieved.length > 0 && (
        <section className="retrieved-sources">
          <h3>Relevant FAU Sources</h3>
          <div className="resource-grid">
            {retrieved.map((src) => {
              const resource = resources.find((r) => r.id === src.resourceId || r.url === src.url);
              const authority = resource?.authority_level || resource?.retrieval_priority || "unknown";
              return (
                <article key={`${src.resourceId}-${src.url}`} className="resource-card">
                  <div>
                    <span>{resource?.category || "FAU"} • {resource?.subcategory || ''}</span>
                    <h3>{src.title || resource?.title || src.url}</h3>
                    <p>{(src.text || "").slice(0, 300)}{(src.text || "").length > 300 ? '…' : ''}</p>
                    <small>Authority: {authority}</small>
                  </div>
                  <div className="card-actions">
                    <a href={src.url} target="_blank" rel="noreferrer" title="Open official FAU page">
                      <ExternalLink size={17} />
                    </a>
                    <button title="Save resource" onClick={() => onSave(resource || { title: src.title || src.url, url: src.url }, resource?.description || src.text || "")}>
                      <Plus size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div className="resource-grid">
        {matchedResources.map(({ resource, match }) => (
          <ResourceCard key={resource.id} resource={resource} match={match} onSave={onSave} />
        ))}
      </div>
    </section>
  );
}

function Summarizer() {
  const [form, setForm] = useState({ url: "", text: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function summarize(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await api("/ai/summarize", {
        method: "POST",
        body: JSON.stringify({
          url: form.url,
          text: form.text
        })
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="summarizer">
      <div className="panel-title">
        <Sparkles size={20} />
        <h2>Page summarizer</h2>
      </div>
      <form onSubmit={summarize}>
        <label>
          FAU page link
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://www.fau.edu/registrar/"
            required
          />
        </label>
        <label>
          Notes or pasted text
          <textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Optional: paste page text here if the page cannot be read automatically."
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="secondary" disabled={loading || form.url.length < 12}>
          {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
          Summarize
        </button>
      </form>

      {result && (
        <div className="summary">
          <span>{result.sentiment}</span>
          <p>{result.summary}</p>
          <h3>Key details</h3>
          <ul>{(result.keyDetails || []).map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Next steps</h3>
          <ul>{(result.nextSteps || []).map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
    </aside>
  );
}

function SavedList({ saved, onDelete }) {
  return (
    <section className="saved">
      <h2>Saved FAU links</h2>
      {saved.length === 0 ? (
        <p className="muted">Save pages you may need later.</p>
      ) : (
        saved.map((item) => (
          <article key={item.id} className="saved-card">
            <div>
              <span>{item.category}</span>
              <h3>{item.title}</h3>
              {item.notes && <p>{item.notes}</p>}
            </div>
            <div className="card-actions">
              <a href={item.url} target="_blank" rel="noreferrer" title="Open official FAU page">
                <ExternalLink size={17} />
              </a>
              <button title="Delete saved link" onClick={() => onDelete(item)}>
                <Trash2 size={17} />
              </button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}

function Dashboard() {
  const [resources, setResources] = useState([]);
  const [saved, setSaved] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("fau-helper-saved") || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const resourceData = await api("/resources");
      setResources(resourceData.resources);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function saveResource(resource, reason) {
    setSaved((current) => {
      if (current.some((item) => item.url === resource.url)) return current;
      return [{
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        title: resource.title,
        url: resource.url,
        category: resource.category || "FAU",
        notes: reason || resource.description || ""
      }, ...current];
    });
  }

  function deleteSaved(item) {
    setSaved((current) => current.filter((savedItem) => savedItem.id !== item.id));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    localStorage.setItem("fau-helper-saved", JSON.stringify(saved));
  }, [saved]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FAU Website Helper</p>
          <h1>Find the FAU page you actually need.</h1>
        </div>
        <p className="lead">Ask in plain English, save useful links, and turn confusing page text into clear next steps.</p>
      </header>

      {error && <p className="error page-error">{error}</p>}

      {loading ? (
        <div className="loading">
          <Loader2 className="spin" size={22} />
          Loading FAU resources
        </div>
      ) : (
        <section className="workspace">
          <div>
            <Finder resources={resources} onSave={saveResource} />
            <SavedList saved={saved} onDelete={deleteSaved} />
          </div>
          <Summarizer />
        </section>
      )}
    </main>
  );
}

function App() {
  return <Dashboard />;
}

createRoot(document.getElementById("root")).render(<App />);
