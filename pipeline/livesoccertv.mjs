// livesoccertv.com (nur Fussball): Wettbewerbsseite listet die naechsten Spiele, jede
// Spielseite hat eine Tabelle Land -> Sender. Kein Free-Kennzeichen - das entscheidet
// channels.json. robots.txt erlaubt /match/ und /competitions/.
// Spielseiten werden gecacht (data/cache/lstv.json), damit pro Lauf nur wenige Requests anfallen.
import fs from 'node:fs';
import path from 'node:path';
import { get, decodeEntities } from './util.mjs';

const BASE = 'https://www.livesoccertv.com';
const COMPS = [
  ['germany/bundesliga', 'bl1'], ['germany/2-bundesliga', 'bl2'], ['germany/3-liga', 'bl3'],
  ['germany/german-cup', 'dfb'], ['international/uefa-champions-league', 'ucl'],
  ['international/uefa-europa-league', 'uel'], ['international/uefa-europa-conference-league', 'uecl'],
  ['international/uefa-nations-league', 'nt']
];

export function parseCompetition(html, comp) {
  const out = [];
  for (const r of html.matchAll(/<tr id="(\d+)" class="matchrow[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const a = r[2].match(/<a href="(\/match\/[^"#]+)[^"]*" title="([^"]+)"/);
    const dv = +(r[2].match(/dv='(\d+)'/) || [])[1];
    if (!a || !dv) continue;
    const [home, away = ''] = decodeEntities(a[2]).split(/\s+vs\s+/);
    out.push({ comp, path: a[1], kickoffUTC: new Date(dv).toISOString(), home: home.trim(), away: away.trim() });
  }
  return out;
}

export function parseMatch(html) {
  const i = html.indexOf('dynamic-international-tv');
  if (i < 0) return [];
  // Tabelle endet vor dem Footer-Block; dort beginnen Zeilen ohne Laenderflagge.
  const end = html.indexOf('</table>', i);
  const table = html.slice(i, end > i ? end : i + 80000);
  const rows = [];
  for (const r of table.split(/<tr/).slice(1)) {
    const slug = (r.match(/flag ([a-z-]+)/) || [])[1];
    if (!slug) continue;
    const channels = [...r.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((x) => decodeEntities(x[1]).trim()).filter(Boolean);
    rows.push({ slug, channels });
  }
  return rows;
}

export async function fetchLivesoccertv({ wanted, cacheFile, maxAgeMs, horizonMs, log }) {
  const errors = [];
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { /* erster Lauf */ }

  const listed = [];
  for (const [path, comp] of COMPS) {
    if (!wanted.has(comp)) continue;
    try {
      listed.push(...parseCompetition(await get(`${BASE}/competitions/${path}/`), comp));
    } catch (e) {
      errors.push(`livesoccertv ${path}: ${e.message}`);
    }
  }

  const now = Date.now();
  let fetched = 0;
  for (const m of listed) {
    const ko = Date.parse(m.kickoffUTC);
    if (ko < now - 3 * 3600e3 || ko > now + horizonMs) continue;
    const c = cache[m.path];
    if (c && now - c.fetchedAt < maxAgeMs) continue;
    try {
      const rows = parseMatch(await get(BASE + m.path));
      cache[m.path] = { fetchedAt: now, rows };
      fetched++;
    } catch (e) {
      errors.push(`livesoccertv ${m.path}: ${e.message}`);
    }
  }
  // Alte Eintraege (Spiel vorbei) entfernen.
  const keep = new Set(listed.map((m) => m.path));
  for (const k of Object.keys(cache)) if (!keep.has(k) && now - cache[k].fetchedAt > 7 * 86400e3) delete cache[k];
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  log(`livesoccertv: ${listed.length} Spiele gelistet, ${fetched} Spielseiten neu geladen`);

  return { items: listed.map((m) => ({ ...m, rows: cache[m.path]?.rows || null })), errors };
}
