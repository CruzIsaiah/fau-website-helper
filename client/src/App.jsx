import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, FileText, Plus, RotateCcw } from 'lucide-react';
import AnswerPanel from './AnswerPanel.jsx';
import { prepareAnswer } from './answerPresentation.js';
import { api } from './api.js';
import { CampusPanel, Composer, EventBanner, Header, PinnedLinks, QuickLinks } from './Homepage.jsx';
import { ResultCard, SavedSection, SummarizerModal } from './ResourceTools.jsx';
import { createPinnedLink, createSavedItem, parsePinnedLinks, parseSavedLinks } from './utils.js';
import NavigationCard from './navigation/NavigationCard.jsx';
const RouteMap = lazy(() => import('./navigation/RouteMap.jsx'));
const SAVED = 'fau-helper-saved';
const PINNED = 'fau-helper-pinned';
const CHAT = 'fau-helper-conversation';
const SUGGESTIONS = ['Library to the gym', 'Find my advisor', 'Where can I park?'];
function read(key, storage = localStorage) { try { return storage.getItem(key); } catch { return null; } }
function persist(key, value, storage = localStorage) { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function restoreConversation() {
  try { const data = JSON.parse(read(CHAT, sessionStorage)); return Array.isArray(data) ? data.filter(t => t && typeof t.id === 'string' && typeof t.question === 'string').map(t => t.status === 'loading' ? { ...t, status: 'error', error: 'This request was interrupted. Please try again.' } : t) : []; } catch { return []; }
}
export default function App() {
  const [resources, setResources] = useState([]);
  const [resourceError, setResourceError] = useState('');
  const [saved, setSaved] = useState(() => parseSavedLinks(read(SAVED)));
  const [pinned, setPinned] = useState(() => parsePinnedLinks(read(PINNED)));
  const [turns, setTurns] = useState(restoreConversation);
  const [view, setView] = useState(() => read('fau-helper-view', sessionStorage) === 'conversation' ? 'conversation' : 'home');
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [summarizerOpen, setSummarizerOpen] = useState(false);
  const request = useRef(null);
  const busy = turns.some(t => t.status === 'loading');
  const savedUrls = useMemo(() => new Set(saved.map(i => i.url)), [saved]);
  const pinnedUrls = useMemo(() => new Set(pinned.map(i => i.url)), [pinned]);
  useEffect(() => {
    const controller = new AbortController();
    api('/resources', { signal: controller.signal }).then(data => setResources(data.resources || [])).catch(e => { if (e.name !== 'AbortError') setResourceError('Quick links could not load. Please refresh to try again.'); });
    return () => controller.abort();
  }, []);
  useEffect(() => { persist(CHAT, turns, sessionStorage); }, [turns]);
  useEffect(() => { try { sessionStorage.setItem('fau-helper-view', view); } catch { /* Browsing without storage remains usable. */ } }, [view]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  function setPage(next) { setView(next); setError(''); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function updateSaved(resource) {
    const exists = savedUrls.has(resource.url);
    const next = exists ? saved.filter(i => i.url !== resource.url) : [createSavedItem(resource), ...saved];
    setSaved(next); setNotice(persist(SAVED, next) ? exists ? 'Removed from saved links.' : 'Saved for later.' : 'Updated for this visit. Browser storage is unavailable.');
  }
  function updatePinned(resource) {
    const exists = pinnedUrls.has(resource.url);
    const next = exists ? pinned.filter(i => i.url !== resource.url) : [createPinnedLink(resource), ...pinned];
    setPinned(next); setNotice(persist(PINNED, next) ? exists ? 'Link unpinned.' : 'Added to pinned links.' : 'Updated for this visit. Browser storage is unavailable.');
  }
  function renamePinned(id, displayName) {
    const next = pinned.map(i => i.id === id ? { ...i, displayName } : i);
    setPinned(next); setNotice(persist(PINNED, next) ? 'Pinned link renamed.' : 'Renamed for this visit. Browser storage is unavailable.');
  }
  function patch(id, update, controller) {
    if (controller?.signal.aborted) return;
    setTurns(current => current.map(t => t.id === id ? { ...t, ...update } : t));
  }
  async function runSearch(raw, { followUp = false, retry } = {}) {
    const clean = raw.trim().replace(/\s+/g, ' ');
    if (clean.length < 3) { setError('Ask a question using at least three characters.'); return; }
    if (busy && !retry) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const history = retry?.history || (followUp ? turns.filter(t => t.status === 'ready').slice(-6).map(t => ({ question: t.question })) : []);
    const id = retry?.id || crypto.randomUUID();
    const turn = { id, question: clean, history, status: 'loading', matches: [], sources: [], usefulLinks: [], answer: null, navigation: null, error: '' };
    setTurns(current => retry ? current.map(t => t.id === id ? turn : t) : [...current, turn]);
    setQuestion(''); setError(''); setView('conversation');
    // Move only after an explicit submission; arriving answers never scroll the page.
    requestAnimationFrame(() => document.getElementById(`turn-${id}`)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    try {
      const body = JSON.stringify({ question: clean, ...(history.length ? { history } : {}) });
      const found = await api('/ai/find', { method: 'POST', signal: controller.signal, body });
      if (found.kind === 'navigation') { patch(id, { navigation: found, status: 'ready' }, controller); return; }
      const matches = Array.isArray(found.matches) ? found.matches : [];
      const activeResource = resources.find(r => r.id === matches[0]?.resourceId);
      patch(id, { matches, activeResource }, controller);
      if (!matches.length) { patch(id, { status: 'ready' }, controller); return; }
      const result = await api('/ai/research', { method: 'POST', signal: controller.signal, body });
      patch(id, { ...prepareAnswer(result), status: 'ready' }, controller);
    } catch (e) { if (e.name !== 'AbortError') patch(id, { status: 'error', error: e.message }, controller); }
  }
  async function chooseNavigation(turn, field, id) {
    const nav = turn.navigation; const controller = new AbortController(); request.current?.abort(); request.current = controller;
    patch(turn.id, { status: 'loading' }, controller);
    try {
      const navigation = await api('/navigation/route', { method: 'POST', signal: controller.signal, body: JSON.stringify({ from: field === 'from' ? id : nav.originResult.location?.id || nav.from, to: field === 'to' ? id : nav.destinationResult.location?.id || nav.to }) });
      patch(turn.id, { navigation, status: 'ready', error: '' }, controller);
    } catch (e) { if (e.name !== 'AbortError') patch(turn.id, { status: 'error', error: e.message }, controller); }
  }
  async function summarizeResource(turn, resource) {
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    patch(turn.id, { status: 'loading', activeResource: resource }, controller);
    try {
      const data = await api('/ai/summarize-resource', { method: 'POST', signal: controller.signal, body: JSON.stringify({ url: resource.url, title: resource.title, program: resource.program, degree: resource.degree, originalQuery: turn.question }) });
      patch(turn.id, { ...prepareAnswer(data), status: 'ready', error: '' }, controller);
    } catch (e) { if (e.name !== 'AbortError') patch(turn.id, { status: 'error', error: e.message }, controller); }
  }
  function newChat() { request.current?.abort(); setTurns([]); setQuestion(''); setPage('home'); }
  return <div className="assistant-app"><Header onHome={() => setPage('home')} />
    {view === 'home' ? <main>
      <EventBanner />
      <div className="page-width">
        <section className="welcome"><h1>What can we help you find?</h1><p>Ask about FAU, find resources, or get walking directions.</p><Composer value={question} onChange={setQuestion} onSubmit={runSearch} loading={busy} />
          <div className="prompt-suggestions">{SUGGESTIONS.map(text => <button type="button" key={text} onClick={() => runSearch(text)} disabled={busy}>{text}</button>)}</div>
          {!!turns.length && <button className="resume-chat" onClick={() => setPage('conversation')} type="button">Continue your conversation <ArrowLeft size={15} className="point-right" /></button>}
          {error && <p role="alert" className="page-error">{error}</p>}
        </section>
        {resourceError && <p className="page-error" role="alert">{resourceError}</p>}
        <QuickLinks resources={resources} />
        <div className="supporting-row"><PinnedLinks pinned={pinned} onRename={renamePinned} onUnpin={updatePinned} /><CampusPanel /></div>
        <div className="home-tools"><details><summary>Saved links{saved.length ? ` (${saved.length})` : ''}</summary><SavedSection saved={saved} onRemove={updateSaved} onPin={updatePinned} pinnedUrls={pinnedUrls} /></details><button type="button" onClick={() => setSummarizerOpen(true)}><FileText size={15} />Page summarizer</button></div>
        <footer className="campus-footer">Made for Owls.</footer>
      </div>
    </main> : <main className="conversation-page">
      <div className="conversation-controls"><button type="button" onClick={() => setPage('home')}><ArrowLeft size={19} />Back to home</button><button type="button" onClick={newChat} className="new-chat"><Plus size={19} />New chat</button></div>
      {!turns.length && <div className="conversation-intro"><h1>What’s on your mind?</h1><p>Ask about FAU to start a conversation.</p></div>}
      {turns.map((turn, index) => <article className="conversation-turn" key={turn.id} id={`turn-${turn.id}`} aria-label={`Question ${index + 1}`}>
        <p className="question-eyebrow">You asked</p>{index === 0 ? <h1 className="user-question">{turn.question}</h1> : <h2 className="user-question">{turn.question}</h2>}
        {turn.error && <div className="conversation-error" role="alert"><AlertCircle size={22} /><div><h3>We couldn’t complete that request.</h3><p>{turn.error}</p><button type="button" onClick={() => runSearch(turn.question, { retry: turn })} disabled={busy}><RotateCcw size={16} />Try again</button></div></div>}
        {turn.navigation ? <div className="conversation-navigation"><Suspense fallback={<div className="map-loading">Loading campus map…</div>}><RouteMap result={turn.navigation} /></Suspense><NavigationCard result={turn.navigation} onChoose={(field, id) => { if (!busy) void chooseNavigation(turn, field, id); }} />{turn.status === 'loading' && <p role="status">Updating walking directions…</p>}</div> : <>
          {turn.status !== 'error' && <AnswerPanel key={`${turn.id}-${turn.activeResource?.id}`} answer={turn.answer} sources={turn.sources} usefulLinks={turn.usefulLinks} activeResource={turn.activeResource} loading={turn.status === 'loading'} saved={savedUrls.has(turn.activeResource?.url)} pinned={pinnedUrls.has(turn.activeResource?.url)} onSave={updateSaved} onPin={updatePinned} />}
          {turn.matches.length > 0 && <details className="related-resources"><summary>Related resources</summary><div className="result-list">{turn.matches.map(match => {
            const resource = resources.find(r => r.id === match.resourceId); return resource && <ResultCard key={resource.id} resource={resource} match={match} saved={savedUrls.has(resource.url)} pinned={pinnedUrls.has(resource.url)} reading={busy} onSummarize={r => summarizeResource(turn, r)} onSave={updateSaved} onPin={updatePinned} />;
          })}</div></details>}
        </>}
      </article>)}
      <section className="follow-up-section" aria-label="Continue the conversation"><h2>Continue the conversation</h2><Composer value={question} onChange={setQuestion} onSubmit={text => runSearch(text, { followUp: true })} loading={busy} followUp />{error && <p className="page-error" role="alert">{error}</p>}<p className="sources-note">Check linked FAU pages for the latest details.</p></section>
    </main>}
    <SummarizerModal open={summarizerOpen} onClose={() => setSummarizerOpen(false)} />
    <div className={`toast ${notice ? 'visible' : ''}`} role="status"><CheckCircle2 size={16} />{notice}</div>
  </div>;
}
