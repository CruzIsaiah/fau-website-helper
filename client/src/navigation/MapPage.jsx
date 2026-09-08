import { useEffect, useRef, useState } from 'react';
import NavigationCard from './NavigationCard.jsx';
import LocationField from './LocationField.jsx';
import RouteMap from './RouteMap.jsx';
export default function MapPage() {
  const initial = new URLSearchParams(window.location.search);
  const [from, setFrom] = useState({ name: initial.get('from') || '', id: '' });
  const [to, setTo] = useState({ name: initial.get('to') || '', id: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(null);
  async function route(a, b, updateUrl = true) {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setLoading(true); setResult(null); setError('');
    if (updateUrl) window.history.pushState({}, '', `/map?${new URLSearchParams({ from: a, to: b })}`);
    try {
      const response = await fetch('/api/navigation/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: a, to: b }), signal: request.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load route.');
      if (request.signal.aborted) return;
      setResult(data);
      setFrom({ name: data.originResult.location?.name || a, id: data.originResult.location?.id || '' });
      setTo({ name: data.destinationResult.location?.name || b, id: data.destinationResult.location?.id || '' });
    } catch (e) { if (e.name !== 'AbortError') setError(e.message); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }
  useEffect(() => {
    function readUrl() {
      const params = new URLSearchParams(window.location.search);
      const a = params.get('from') || ''; const b = params.get('to') || '';
      setFrom({ name: a, id: '' }); setTo({ name: b, id: '' });
      if (a || b) void route(a, b, false);
      else { controller.current?.abort(); setResult(null); setError(''); setLoading(false); }
    }
    readUrl(); window.addEventListener('popstate', readUrl);
    return () => { controller.current?.abort(); window.removeEventListener('popstate', readUrl); };
  }, []);
  function choose(field, id) { void route(field === 'from' ? id : from.id || from.name, field === 'to' ? id : to.id || to.name); }
  return <div className="app-shell"><header className="app-header"><a className="brand" href="/">← FAU Website Helper</a></header>
    <main className="map-page"><p className="section-kicker">Find your way around FAU</p><h1>Campus walking directions</h1><p>Use a building name or try “gym,” “cafeteria,” or “library.”</p>
      <form className="route-form" onSubmit={e => { e.preventDefault(); void route(from.id || from.name, to.id || to.name); }}>
        <LocationField label="From" value={from.name} onChange={(name, id = '') => setFrom({ name, id })} />
        <button className="swap-route" type="button" aria-label="Swap starting point and destination" onClick={() => { setFrom(to); setTo(from); void route(to.id || to.name, from.id || from.name); }}>⇄</button>
        <LocationField label="To" value={to.name} onChange={(name, id = '') => setTo({ name, id })} />
        <button className="route-submit" type="submit" disabled={loading}>{loading ? 'Finding route…' : 'Get walking route'}</button>
      </form>
      {error && <p className="page-error" role="alert">{error}</p>}
      <div className="map-layout" aria-busy={loading}><RouteMap result={result} /><div aria-live="polite">{loading ? <p>Finding your walking route…</p> : result ? <NavigationCard result={result} onChoose={choose} /> : <section className="navigation-card"><h2>Where would you like to go?</h2><p>Choose your starting point and destination to see them on the map.</p></section>}</div></div>
    </main></div>;
}
