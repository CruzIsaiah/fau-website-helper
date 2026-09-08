export default function NavigationCard({ result, onChoose }) {
  if (!result) return null;
  if (result.status === 'needs_locations') return <section className="navigation-card" aria-label="Choose campus locations">
    <p className="section-kicker">Campus navigation</p><h2>Let’s find your locations</h2>
    {['originResult', 'destinationResult'].map((key, index) => {
      const item = result[key]; const field = index === 0 ? 'from' : 'to';
      return item.status !== 'resolved' ? <div key={key}><p>{item.status === 'ambiguous' ? `Which ${index === 0 ? 'starting point' : 'destination'} did you mean?` : item.query ? `I couldn’t find “${item.query}”. Choose a campus location on the map.` : `Choose your ${index === 0 ? 'starting point' : 'destination'} on the map.`}</p>
        <div className="location-choices">{item.choices.map(l => <button key={l.id} type="button" onClick={() => onChoose(field, l.id)}>{l.name}<small>{l.campus} · {l.categories.join(', ')}</small></button>)}</div></div> : <p key={key}>{index === 0 ? 'From' : 'To'}: {item.location.name}</p>;
    })}
    <a href={`/map?${new URLSearchParams({ from: result.originResult.location?.id || result.from, to: result.destinationResult.location?.id || result.to })}`}>Choose locations on map</a>
  </section>;
  return <section className="navigation-card" aria-label="Walking directions">
    <p className="section-kicker">Campus navigation · Walking</p>
    <h2>{result.origin.name} <span aria-label="to">→</span> {result.destination.name}</h2>
    {result.route && <p className="route-duration">About {Math.max(1, Math.round(result.route.duration / 60))} min walk · {Math.round(result.route.distance)} m</p>}
    {result.summary && <p className="campus-route-summary">{result.summary}</p>}
    {result.directions && <details className="route-details" key={result.viewRouteUrl}>
      <summary>Show detailed directions</summary>
      <ol className="route-directions">{result.directions.map((text, i) => <li key={i}>{text}</li>)}</ol>
      {result.landmarks?.length > 0 && <p className="route-note">Near the route: {result.landmarks.map(l => l.name).join('; ')}.</p>}
    </details>}
    <p className="route-note">{result.message}</p>
    <div className="route-actions"><a href={result.viewRouteUrl}>View Route</a><a href={result.mapsUrl} target="_blank" rel="noopener noreferrer">Open in Maps ↗</a></div>
    {result.route && <small className="route-attribution">{result.route.attribution}</small>}
  </section>;
}
