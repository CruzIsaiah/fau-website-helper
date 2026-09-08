import { useEffect, useState } from 'react';
export default function LocationField({ label, value, onChange }) {
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/navigation/locations?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json(); setResults(data.locations); setError('');
      } catch (e) { if (e.name !== 'AbortError') { setResults([]); setError('Location search is unavailable. Try again.'); } }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value]);
  const id = `location-${label.toLowerCase()}`;
  function select(location) {
    onChange(location.name, location.id); setFocused(false); setActiveIndex(-1);
  }
  function onKeyDown(event) {
    if (event.key === 'Escape') { setFocused(false); setActiveIndex(-1); }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) {
      event.preventDefault(); setFocused(true);
      setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
    }
    if (event.key === 'Enter' && focused && results[activeIndex]) { event.preventDefault(); select(results[activeIndex]); }
  }
  return <div className="location-field" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <label htmlFor={id}>{label}</label>
    <input id={id} value={value} onChange={e => { setResults([]); setActiveIndex(-1); onChange(e.target.value); }} onFocus={() => setFocused(true)} onKeyDown={onKeyDown} role="combobox" aria-autocomplete="list" aria-activedescendant={focused && results[activeIndex] ? `${id}-option-${activeIndex}` : undefined} placeholder={label === 'From' ? 'Try gym or library' : 'Where are you heading?'} autoComplete="off" maxLength={180} aria-expanded={focused && results.length > 0} aria-controls={`${id}-suggestions`} />
    {focused && <div id={`${id}-suggestions`} className="location-suggestions" role="listbox" aria-label={`${label} suggestions`}>{results.map((l, i) => <button key={l.id} id={`${id}-option-${i}`} role="option" aria-selected={activeIndex === i} type="button" onClick={() => select(l)}>{l.name}<small>{l.campus} · {l.categories.join(', ')}</small></button>)}{error && <p role="alert">{error}</p>}</div>}
  </div>;
}
