import { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Loader2, LogOut, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = "/api";

function useStoredSession() {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("fau-helper-session");
    return raw ? JSON.parse(raw) : null;
  });

  function save(next) {
    setSession(next);
    if (next) localStorage.setItem("fau-helper-session", JSON.stringify(next));
    else localStorage.removeItem("fau-helper-session");
  }

  return [session, save];
}

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function Auth({ onSession }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      onSession(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">FAU Website Helper</p>
          <h1>Find the FAU page you actually need.</h1>
          <p className="lead">Ask in plain English, save important links, and turn confusing page text into clear next steps.</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="segmented">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              Login
            </button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
              Register
            </button>
          </div>
          {mode === "register" && (
            <label>
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <BookOpen size={18} />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
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

function Finder({ token, resources, onSave }) {
  const [question, setQuestion] = useState("");
  const [matches, setMatches] = useState([]);
  const [answer, setAnswer] = useState("");
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

    try {
      const data = await api("/ai/find", {
        token,
        method: "POST",
        body: JSON.stringify({ question })
      });
      setAnswer(data.answer || "");
      setMatches(data.matches || []);
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

      <div className="resource-grid">
        {matchedResources.map(({ resource, match }) => (
          <ResourceCard key={resource.id} resource={resource} match={match} onSave={onSave} />
        ))}
      </div>
    </section>
  );
}

function Summarizer({ token }) {
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
        token,
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

function Dashboard({ session, onLogout }) {
  const [resources, setResources] = useState([]);
  const [saved, setSaved] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const token = session.token;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [resourceData, savedData] = await Promise.all([api("/resources"), api("/saved", { token })]);
      setResources(resourceData.resources);
      setSaved(savedData.saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveResource(resource, reason) {
    const data = await api("/saved", {
      token,
      method: "POST",
      body: JSON.stringify({
        title: resource.title,
        url: resource.url,
        category: resource.category,
        notes: reason || resource.description
      })
    });
    setSaved((current) => [data.saved, ...current]);
  }

  async function deleteSaved(item) {
    await api(`/saved/${item.id}`, { token, method: "DELETE" });
    setSaved((current) => current.filter((savedItem) => savedItem.id !== item.id));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FAU Website Helper</p>
          <h1>Welcome, {session.user.name}</h1>
        </div>
        <button className="icon-button" title="Sign out" onClick={onLogout}>
          <LogOut size={20} />
        </button>
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
            <Finder token={token} resources={resources} onSave={saveResource} />
            <SavedList saved={saved} onDelete={deleteSaved} />
          </div>
          <Summarizer token={token} />
        </section>
      )}
    </main>
  );
}

function App() {
  const [session, setSession] = useStoredSession();
  return session ? <Dashboard session={session} onLogout={() => setSession(null)} /> : <Auth onSession={setSession} />;
}

createRoot(document.getElementById("root")).render(<App />);
