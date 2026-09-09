import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUp, ArrowUpRight, CalendarDays, FileText, GraduationCap, Loader2, MapPin, MessageCircle, MoreVertical, Pencil, Pin, Trash2, Users } from 'lucide-react';
import { api } from './api.js';

export function Header({ onHome }) {
  return <header className="campus-header"><div className="page-width header-inner">
    <a className="campus-brand" href="/" onClick={onHome ? e => { e.preventDefault(); onHome(); } : undefined} aria-label="FAU Campus Assistant home"><strong>FAU</strong><span>Campus Assistant</span></a>
    <a className="header-map" href="/map"><MapPin size={21} aria-hidden="true" /><span>Campus map</span></a>
  </div></header>;
}

export function EventBanner() {
  const [event, setEvent] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api('/events', { signal: controller.signal }).then(data => {
      const candidate = data.event;
      if (candidate && Date.parse(candidate.start) > Date.now() && /^https:\/\/calendar\.fau\.edu\/event\//.test(candidate.url)) setEvent(candidate);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  return <section className="event-banner" aria-label="Around campus">
    <img src="/images/fau-entrance-banner.webp" alt="" className="campus-photo" fetchPriority="high" />
    <div className="page-width event-inner"><div className="event-copy">
      <p className="event-eyebrow">Around campus</p>
      <h2>{event?.title || 'Your campus, connected.'}</h2>
      {event ? <p className="event-description"><time dateTime={event.start}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'America/New_York' }).format(new Date(event.start))}</time>{event.location ? ` · ${event.location}` : ''}{event.description && <span>{event.description}</span>}</p> : <p className="event-description">Explore the resources and places that make FAU yours.</p>}
      <a className="event-action" href={event?.url || '/map'} {...(event ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{event ? 'Explore event' : 'Explore campus'}<ArrowRight size={21} aria-hidden="true" /></a>
    </div></div>
  </section>;
}

export function Composer({ value, onChange, onSubmit, loading, followUp = false }) {
  const id = followUp ? 'follow-up' : 'campus-question';
  return <form className="question-form" onSubmit={e => { e.preventDefault(); onSubmit(value); }}>
    <label htmlFor={id} className="sr-only">{followUp ? 'Ask a follow-up question' : 'Ask a question or get directions'}</label>
    <div className="question-control">{!followUp && <MessageCircle size={25} aria-hidden="true" />}
      <input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={followUp ? 'Ask a follow-up question...' : 'Ask a question or get directions...'} maxLength={600} autoComplete="off" />
      <button type="submit" aria-label={loading ? 'Waiting for answer' : 'Send question'} disabled={loading || !value.trim()}>{loading ? <Loader2 className="spin" size={23} /> : <ArrowUp size={25} />}</button>
    </div>
  </form>;
}

export function QuickLinks({ resources }) {
  const definitions = [['canvas', 'Canvas', GraduationCap], ['myfau', 'MyFAU', FileText], ['academic-calendar', 'Academic calendar', CalendarDays], ['fau-directory', 'FAU directory', Users]];
  return <section className="quick-section" aria-labelledby="quick-heading"><h2 id="quick-heading">Quick links</h2><div className="quick-grid">
    {definitions.map(([id, label, Icon]) => {
      const resource = resources.find(r => r.id === id);
      return resource ? <a key={id} href={resource.url} target="_blank" rel="noopener noreferrer"><Icon size={31} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={20} aria-hidden="true" /></a> : <div className="quick-placeholder" key={id}><Icon size={31} aria-hidden="true" /><span>{label}</span><small>Unavailable</small></div>;
    })}
  </div></section>;
}

export function PinnedLinks({ pinned, onRename, onUnpin }) {
  const [editing, setEditing] = useState('');
  const [name, setName] = useState('');
  return <section className="pinned-panel" aria-labelledby="pinned-heading"><h2 id="pinned-heading">Pinned links</h2>
    {!pinned.length ? <div className="pinned-empty"><Pin size={22} aria-hidden="true" /><p>Your useful pages, close at hand.<small>Pin a source from an answer to keep it here.</small></p></div> : <div className="home-pins">{pinned.map(item => editing === item.id ?
      <form className="pin-rename-form" key={item.id} onSubmit={e => { e.preventDefault(); const clean = name.trim().replace(/\s+/g, ' '); if (clean) { onRename(item.id, clean); setEditing(''); } }}><label htmlFor={`rename-${item.id}`}>Rename pinned link</label><input autoFocus id={`rename-${item.id}`} value={name} maxLength={80} onChange={e => setName(e.target.value)} /><div><button type="button" onClick={() => setEditing('')}>Cancel</button><button type="submit" className="pin-save-name">Save</button></div></form> :
      <div className="home-pin" key={item.id}><Pin size={17} aria-hidden="true" /><a href={item.url} target="_blank" rel="noopener noreferrer" title={item.originalTitle}>{item.displayName}<ArrowUpRight size={19} aria-hidden="true" /></a><details className="item-menu"><summary aria-label={`Actions for ${item.displayName}`}><MoreVertical size={19} /></summary><div><button type="button" onClick={() => { setEditing(item.id); setName(item.displayName); }}><Pencil size={15} />Rename</button><button type="button" onClick={() => onUnpin(item)}><Trash2 size={15} />Unpin</button></div></details></div>)}</div>}
  </section>;
}

export function CampusPanel() {
  return <section className="campus-panel"><MapPin size={51} strokeWidth={1.6} aria-hidden="true" /><div><h2>Find your way around campus</h2><p>Walking directions with helpful landmarks.</p><a href="/map">Open campus map <ArrowRight size={20} aria-hidden="true" /></a></div></section>;
}
