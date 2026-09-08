import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
export default function RouteMap({ result }) {
  const container = useRef(null);
  useEffect(() => {
    const map = L.map(container.current).setView([26.3725, -80.1025], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    const bounds = [];
    for (const [i, l] of [result?.origin || result?.originResult?.location, result?.destination || result?.destinationResult?.location].entries()) {
      if (!l) continue;
      const coordinate = [l.lat, l.lng]; bounds.push(coordinate);
      const label = document.createElement('span'); label.textContent = `${i === 0 ? 'From' : 'To'}: ${l.name}`;
      L.marker(coordinate, { title: label.textContent, icon: L.divIcon({ className: `campus-marker marker-${i}`, html: i === 0 ? 'A' : 'B', iconSize: [30, 30], iconAnchor: [15, 30] }) }).bindTooltip(label).addTo(map);
    }
    if (result?.route) {
      const line = L.geoJSON({ type: 'Feature', geometry: result.route.geometry, properties: {} }, { style: { color: '#126bd9', weight: 5 } }).addTo(map);
      map.fitBounds(line.getBounds().extend(bounds), { padding: [36, 36], maxZoom: 18 });
    } else if (bounds.length) map.fitBounds(bounds, { padding: [45, 45], maxZoom: 17 });
    const resize = new ResizeObserver(() => map.invalidateSize()); resize.observe(container.current);
    return () => { resize.disconnect(); map.remove(); };
  }, [result]);
  return <div ref={container} className="campus-map" aria-label="Campus map with starting point A and destination B" />;
}
