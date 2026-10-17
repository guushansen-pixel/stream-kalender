// liveonsat.com: eine Seite pro Wettbewerb, pro Spiel ein "blockfix"-Block mit UTC-Timestamp
// und Senderliste. Klasse chan_live_free = unverschluesselt per Satellit (NICHT automatisch
// legal - das entscheidet erst channels.json), _not_free = verschluesselt, _iptvcable = Stream.
import { get, decodeEntities } from './util.mjs';

// Eintrag = Hauptseite, optional mit Ersatzseiten, falls sie abgewiesen wird (aus GitHub-
// Actions-IPs kam fuer die grosse Deutschland-Seite schon ein 403, die Einzelseiten gingen).
const PAGES = [
  ['europe-germany-all-football', 'europe-germany-bundesliga1', 'europe-germany-bundesliga2', 'europe-germany-dfb-Pokal'], // 1.-3. Liga + DFB-Pokal
  'club-uefa-champions-league',
  'club-uefa-europa-league',
  'club-uefa-europa-conference-league',
  'international-uefa-nations-league',
  'international-friendly-matches',
  'x-international-basketball',
  'x-olympic-handball',
  'x-boxing-mma'
];

// Ueberschrift (comp_head) -> Wettbewerbs-ID
const COMP = [
  [/German 1\. Bundesliga/i, 'bl1'], [/German 2\. Bundesliga/i, 'bl2'], [/German 3\. Liga/i, 'bl3'],
  [/DFB-Pokal|German Cup/i, 'dfb'], [/Champions League/i, 'ucl'], [/Europa League/i, 'uel'],
  [/Conference League/i, 'uecl'], [/Nations League|Friendly|World Cup Qual|Euro.*Qual/i, 'nt'],
  [/Euroleague/i, 'el'], [/Eurocup/i, 'ec'], [/Handball/i, 'hb'], [/Boxing/i, 'box']
];

export function parseLiveonsat(html) {
  const out = [];
  // Ueberschriften und Bloecke stehen in Dokumentreihenfolge; die letzte Ueberschrift vor
  // einem Block gilt fuer ihn.
  const re = /<span class = comp_head>([^<]*)<\/span>|<div class = blockfix >([\s\S]*?)<!-- block 1 ENDS-->/g;
  let head = '';
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) { head = decodeEntities(m[1]).trim(); continue; }
    const b = m[2];
    const teams = decodeEntities((b.match(/class = fLeft style="[^"]*">([^<]+)<\/div>/) || [])[1] || '').trim();
    const ts = +(b.match(/data-timestamp="(\d+)"/) || [])[1];
    if (!teams || !ts) continue;
    const [home, away = ''] = teams.split(/\s+v\s+/);
    const comp = (COMP.find(([rx]) => rx.test(head)) || [])[1] || null;
    const channels = [];
    for (const a of b.matchAll(/<a [\s\S]*?<\/a>/g)) {
      const tag = a[0];
      const cls = (tag.match(/class = chan_live_(\w+)/) || [])[1];
      const raw = (tag.match(/>([^<>]*)<\/a>$/) || [])[1];
      if (!cls || !raw) continue;
      const text = decodeEntities(raw).replace(/📺/g, '').trim();
      const href = (tag.match(/<a href="([^"]*)"/) || [])[1];
      // Zusaetze wie "($/geo/R)" oder "[app]" abtrennen, aber merken.
      const flags = (text.match(/[([][^)\]]*[)\]]/g) || []).join(' ');
      const name = text.replace(/[([][^)\]]*[)\]]/g, '').replace(/\s+/g, ' ').trim();
      channels.push({ name, type: cls, flags, href: href && href !== '#' ? href : null });
    }
    out.push({ head, comp, home: home.trim(), away: away.trim(), kickoffUTC: new Date(ts * 1000).toISOString(), channels });
  }
  return out;
}

export async function fetchLiveonsat({ log }) {
  const all = [], errors = [];
  const load = async (p) => {
    try { return await get(`https://liveonsat.com/${p}.php`); } catch {
      // ein zweiter Versuch nach kurzer Pause, dann aufgeben
      return get(`https://liveonsat.com/${p}.php`, { gapMs: 15000 });
    }
  };
  for (const entry of PAGES) {
    const [main, ...fallbacks] = [].concat(entry);
    try {
      all.push(...parseLiveonsat(await load(main)));
    } catch (e) {
      errors.push(`liveonsat ${main}: ${e.message}${fallbacks.length ? ' - nutze Einzelseiten' : ''}`);
      for (const f of fallbacks) {
        try { all.push(...parseLiveonsat(await load(f))); } catch (e2) { errors.push(`liveonsat ${f}: ${e2.message}`); }
      }
    }
  }
  log(`liveonsat: ${all.length} Eintraege`);
  return { items: all, errors };
}
