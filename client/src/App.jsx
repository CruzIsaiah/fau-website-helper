import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Loader2, LogOut, Plus, Sparkles, Trash2 } from "lucide-react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = "/api";
const ACCOUNT_CACHE_KEY = "taskflow-demo-accounts";

function useStoredSession() {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("taskflow-session");
    return raw ? JSON.parse(raw) : null;
  });

  function save(next) {
    setSession(next);
    if (next) localStorage.setItem("taskflow-session", JSON.stringify(next));
    else localStorage.removeItem("taskflow-session");
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

async function hashPasswordForBrowser(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readAccountCache() {
  const raw = localStorage.getItem(ACCOUNT_CACHE_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function cacheBrowserAccount(email, password, session) {
  const accounts = readAccountCache();
  accounts[email.toLowerCase()] = {
    passwordHash: await hashPasswordForBrowser(password),
    session
  };
  localStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(accounts));
}

async function restoreBrowserAccount(email, password) {
  const account = readAccountCache()[email.toLowerCase()];
  if (!account) return null;
  const passwordHash = await hashPasswordForBrowser(password);
  return account.passwordHash === passwordHash ? account.session : null;
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
      await cacheBrowserAccount(form.email, form.password, data);
      onSession(data);
    } catch (err) {
      if (mode === "login") {
        const cached = await restoreBrowserAccount(form.email, form.password);
        if (cached) {
          onSession(cached);
          return;
        }
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">TaskFlow AI</p>
          <h1>Plan work with a smarter task board.</h1>
          <p className="lead">Create tasks, organize priorities, and ask AI for useful next steps when the list gets fuzzy.</p>
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
            {loading ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function TaskForm({ token, onCreated }) {
  const [task, setTask] = useState({ title: "", description: "", priority: "medium", dueDate: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await api("/tasks", {
        token,
        method: "POST",
        body: JSON.stringify(task)
      });
      onCreated(data.task);
      setTask({ title: "", description: "", priority: "medium", dueDate: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <input
        placeholder="Task title"
        value={task.title}
        onChange={(e) => setTask({ ...task, title: e.target.value })}
        required
      />
      <textarea
        placeholder="Details"
        value={task.description}
        onChange={(e) => setTask({ ...task, description: e.target.value })}
      />
      <div className="form-row">
        <select value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} />
        <button className="primary" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          Add
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function AiPanel({ token, onAddSuggestion, taskText }) {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [insight, setInsight] = useState(null);
  const [error, setError] = useState("");

  async function getSuggestions() {
    setLoading("suggestions");
    setError("");

    try {
      const data = await api("/ai/suggestions", {
        token,
        method: "POST",
        body: JSON.stringify({ goal, context: taskText })
      });
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function getInsights() {
    setLoading("insights");
    setError("");

    try {
      const data = await api("/ai/insights", {
        token,
        method: "POST",
        body: JSON.stringify({ text: taskText || "No tasks yet." })
      });
      setInsight(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  return (
    <aside className="ai-panel">
      <div className="panel-title">
        <Bot size={20} />
        <h2>AI assistant</h2>
      </div>

      <label>
        Goal
        <textarea
          placeholder="Example: prepare for finals while keeping my part-time schedule"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </label>

      <div className="ai-actions">
        <button className="primary" onClick={getSuggestions} disabled={loading === "suggestions" || goal.length < 3}>
          {loading === "suggestions" ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
          Suggestions
        </button>
        <button className="secondary" onClick={getInsights} disabled={loading === "insights"}>
          {loading === "insights" ? <Loader2 className="spin" size={18} /> : <Bot size={18} />}
          Insights
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((item, index) => (
            <article key={`${item.title}-${index}`} className="suggestion">
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
              <button
                title="Add suggestion"
                onClick={() =>
                  onAddSuggestion({
                    title: item.title,
                    description: item.description,
                    priority: item.priority || "medium"
                  })
                }
              >
                <Plus size={16} />
              </button>
            </article>
          ))}
        </div>
      )}

      {insight && (
        <div className="insight">
          <span>{insight.sentiment}</span>
          <p>{insight.summary}</p>
          <strong>{insight.nextStep}</strong>
        </div>
      )}
    </aside>
  );
}

function Dashboard({ session, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const token = session.token;
  const grouped = useMemo(
    () => ({
      todo: tasks.filter((task) => task.status === "todo"),
      doing: tasks.filter((task) => task.status === "doing"),
      done: tasks.filter((task) => task.status === "done")
    }),
    [tasks]
  );
  const taskText = tasks.map((task) => `${task.title}: ${task.description} (${task.status}, ${task.priority})`).join("\n");

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      const data = await api("/tasks", { token });
      setTasks(data.tasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addSuggestion(task) {
    const data = await api("/tasks", {
      token,
      method: "POST",
      body: JSON.stringify(task)
    });
    setTasks((current) => [data.task, ...current]);
  }

  async function setStatus(task, status) {
    const data = await api(`/tasks/${task.id}`, {
      token,
      method: "PUT",
      body: JSON.stringify({ status })
    });
    setTasks((current) => current.map((item) => (item.id === task.id ? data.task : item)));
  }

  async function removeTask(task) {
    await api(`/tasks/${task.id}`, { token, method: "DELETE" });
    setTasks((current) => current.filter((item) => item.id !== task.id));
  }

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TaskFlow AI</p>
          <h1>Welcome, {session.user.name}</h1>
        </div>
        <button className="icon-button" title="Sign out" onClick={onLogout}>
          <LogOut size={20} />
        </button>
      </header>

      <section className="workspace">
        <div className="board-area">
          <TaskForm token={token} onCreated={(task) => setTasks((current) => [task, ...current])} />
          {error && <p className="error">{error}</p>}
          {loading ? (
            <div className="loading">
              <Loader2 className="spin" size={22} />
              Loading tasks
            </div>
          ) : (
            <div className="board">
              {Object.entries(grouped).map(([status, items]) => (
                <section key={status} className="column">
                  <h2>{status}</h2>
                  {items.map((task) => (
                    <article key={task.id} className={`task priority-${task.priority}`}>
                      <div>
                        <strong>{task.title}</strong>
                        {task.description && <p>{task.description}</p>}
                        <small>{task.dueDate || "No due date"} · {task.priority}</small>
                      </div>
                      <div className="task-actions">
                        <select value={task.status} onChange={(e) => setStatus(task, e.target.value)} title="Change status">
                          <option value="todo">Todo</option>
                          <option value="doing">Doing</option>
                          <option value="done">Done</option>
                        </select>
                        <button className="icon-button" title="Delete task" onClick={() => removeTask(task)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
        <AiPanel token={token} taskText={taskText} onAddSuggestion={addSuggestion} />
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useStoredSession();
  return session ? <Dashboard session={session} onLogout={() => setSession(null)} /> : <Auth onSession={setSession} />;
}

createRoot(document.getElementById("root")).render(<App />);
