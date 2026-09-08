import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';

// Only Point placemarks are destinations. Polygons/lines are not entrances or routes.
export function parseKml(xml) {
  const $ = load(xml, { xmlMode: true });
  const locations = new Map();
  $('Placemark').each((_i, element) => {
    const node = $(element);
    const name = node.children('name').text().trim();
    const point = node.find('Point > coordinates').first().text().trim();
    if (!name || !point) return;
    const [lng, lat] = point.split(/[\s,]+/).map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    const folders = node.parents('Folder').toArray().reverse().map(el => $(el).children('name').first().text().trim());
    const key = `${name}|${lng}|${lat}`;
    const existing = locations.get(key);
    const category = folders.at(-1) || 'Campus locations';
    if (existing) { existing.categories = [...new Set([...existing.categories, category])]; return; }
    locations.set(key, { id: createHash('sha256').update(key).digest('hex').slice(0, 16), name, lng, lat, campus: folders.find(folder => /campus|Harbor Branch|Dania Beach|Fort Lauderdale/i.test(folder)) || 'FAU (campus unspecified)', categories: [category] });
  });
  return [...locations.values()];
}
export const campusLocations = parseKml(readFileSync(new URL('./data/campus.kml', import.meta.url), 'utf8'));
