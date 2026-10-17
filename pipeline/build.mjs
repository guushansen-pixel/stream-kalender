// Baut data/matches.json: Spielplaene + Sender pro Spiel, abgeglichen mit der kuratierten
// Registry. Aufruf: node pipeline/build.mjs [--lstv] [--no-los] [--days=45]
// --lstv: livesoccertv zusaetzlich abfragen. Standardmaessig AUS, weil livesoccertv
// automatisierte Clients per Bot-Schutz abweist (403) - das umgehen wir nicht.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFixtures } from './fixtures.mjs';
import { fetchLiveonsat } from './liveonsat.mjs';
import { fetchLivesoccertv } from './livesoccertv.mjs';
import { pairScore, normName, berlin } from './util.mjs';
import { COUNTRY_NAMES, LSTV_SLUG, NAME_HINT } from './countries.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const DAYS = +(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] || 45);
const log = (...a) => console.log('[build]', ...a);
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

export const COMPS = {
  bl1: { name: '1. Bundesliga', sport: 'football' }, bl2: { name: '2. Bundesliga', sport: 'football' },
  bl3: { name: '3. Liga', sport: 'football' }, dfb: { name: 'DFB-Pokal', sport: 'football' },
  ucl: { name: 'Champions League', sport: 'football' }, uel: { name: 'Europa League', sport: 'football' },
  uecl: { name: 'Conference League', sport: 'football' }, nt: { name: 'Nationalmannschaft', sport: 'football' },
  el: { name: 'EuroLeague', sport: 'basketball' }, ec: { name: 'EuroCup', sport: 'basketball' },
  bbl: { name: 'Basketball-Bundesliga', sport: 'basketball' }, 'bb-nt': { name: 'Basketball-Nationalteam', sport: 'basketball' },
  hbwm: { name: 'Handball-WM 2027', sport: 'handball' }, 'hb-nt': { name: 'Handball-Nationalteam', sport: 'handball' },
  'hb-nt-w': { name: 'Handball Frauen-EM', sport: 'handball' }, hb: { name: 'Handball', sport: 'handball' },
  box: { name: 'Box-WM', sport: 'boxing' }, darts: { name: 'Darts-WM', sport: 'darts' }
};
// Wettbewerbe, deren liveonsat-Ueberschrift allgemeiner ist als unsere ID.
const LOS_COMP = { hbwm: 'hb', 'hb-nt': 'hb', 'hb-nt-w': 'hb', 'bb-nt': 'el' };

// ---------------------------------------------------------------- Registry --
const reg = readJson('registry/channels.json');
const channels = reg.channels.map((c) => ({ ...c, re: c.match.map((m) => new RegExp(m, 'i')) }));
const byId = Object.fromEntries(channels.map((c) => [c.id, c]));
const blockRe = readJson('registry/blocklist.json').patterns.map((p) => new RegExp(p, 'i'));
const payRe = readJson('registry/pay.json').patterns.map((p) => new RegExp(p, 'i'));
const rules = readJson('registry/rules.json').rules;
const manual = readJson('registry/manual-events.json');

function classify(name, country) {
  if (blockRe.some((r) => r.test(name))) return { kind: 'block' };
  for (const c of channels) {
    if (!c.re.some((r) => r.test(name))) continue;
    if (country && c.country !== '*' && c.country !== country) continue;
    return { kind: 'free', entry: c };
  }
  if (payRe.some((r) => r.test(name))) return { kind: 'pay' };
  return { kind: 'other' };
}
const hintCountry = (name) => (NAME_HINT.find(([rx]) => rx.test(name)) || [])[1] || '?';
const regionsOf = (c) => (c.country === '*' ? c.regions || [] : [c.country]);
const CONF_RANK = { sicher: 2, 'möglich': 1 };

// ------------------------------------------------------------------ Laufen --
const now = Date.now();
const fromMs = now - 2 * 86400e3, toMs = now + DAYS * 86400e3;
const errors = [];
const review = { ftaUnknown: new Map(), otherUnknown: new Map(), slugs: new Set() };

const fx = await fetchFixtures({ fromMs, toMs, log });
errors.push(...fx.errors);

const los = args.has('--no-los') ? { items: [], errors: [] } : await fetchLiveonsat({ log });
errors.push(...los.errors);

const wantedLstv = new Set(fx.fixtures.filter((f) => f.sport === 'football').map((f) => f.comp));
const lstv = !args.has('--lstv')
  ? { items: [], errors: [] }
  : await fetchLivesoccertv({
    wanted: wantedLstv, cacheFile: path.join(ROOT, 'data/cache/lstv.json'),
    maxAgeMs: 20 * 3600e3, horizonMs: 6 * 86400e3, log
  });
errors.push(...lstv.errors);

// Manuelle Events ins gleiche Format bringen.
const events = [...fx.fixtures];
for (const e of manual.events) {
  if (Date.parse(e.endUTC || e.kickoffUTC) < fromMs) continue;
  events.push({ ...e, sport: e.sport || COMPS[e.comp]?.sport, tbc: !!e.timeTBC, de: true, manual: true });
}

function addOffer(m, chId, country, conf, src, note, label) {
  const o = m.offers.find((x) => x.ch === chId && x.c === country);
  if (!o) { m.offers.push({ ch: chId, c: country, conf, src: [src], note, label }); return; }
  if (label && !o.label) o.label = label;
  if (note && !o.note) o.note = note;
  if (CONF_RANK[conf] > CONF_RANK[o.conf]) o.conf = conf;
  if (!o.src.includes(src)) o.src.push(src);
}
function addList(map, country, name) {
  (map[country] ||= []);
  if (!map[country].includes(name)) map[country].push(name);
}
function bump(map, key, example) {
  const v = map.get(key) || { n: 0, example };
  v.n++; map.set(key, v);
}

// Bestes Gegenstueck aus einer Quelle: gleicher Wettbewerb, Anstoss +-3 h, aehnlichste Paarung.
function bestMatch(m, items, compOf) {
  const ko = Date.parse(m.kickoffUTC);
  const want = LOS_COMP[m.comp] || m.comp;
  let best = null, bestScore = 1.5;
  for (const it of items) {
    if (compOf(it) !== want) continue;
    if (Math.abs(Date.parse(it.kickoffUTC) - ko) > 3 * 3600e3 && !m.tbc) continue;
    if (m.tbc && Math.abs(Date.parse(it.kickoffUTC) - ko) > 30 * 3600e3) continue;
    const s = pairScore(m.home, m.away, it.home, it.away);
    if (s > bestScore) { best = it; bestScore = s; }
  }
  return best;
}

const usedLos = new Set();
function enrich(m) {
  m.offers = []; m.pay = {}; m.other = {};
  const label = `${m.home} – ${m.away} (${m.comp})`;

  // 1) liveonsat
  const l = bestMatch(m, los.items, (it) => it.comp);
  if (l) {
    usedLos.add(l);
    if (m.tbc && m.manual) { m.kickoffUTC = l.kickoffUTC; m.tbc = false; }
    for (const ch of l.channels) {
      const k = classify(ch.name, null);
      if (k.kind === 'block') continue;
      if (k.kind === 'free') {
        const conf = k.entry.access === 'partial' || k.entry.country === '*' ? 'möglich' : 'sicher';
        for (const c of regionsOf(k.entry)) addOffer(m, k.entry.id, c, conf, 'liveonsat', undefined, k.entry.useSourceName ? ch.name.replace(/ HD$/, '') : undefined);
      } else if (k.kind === 'pay') {
        addList(m.pay, hintCountry(ch.name), ch.name);
      } else {
        addList(m.other, hintCountry(ch.name), ch.name);
        bump(ch.type === 'free' ? review.ftaUnknown : review.otherUnknown, ch.name, label);
      }
    }
  }

  // 2) livesoccertv (mit Laenderzuordnung)
  const t = m.sport === 'football' ? bestMatch(m, lstv.items, (it) => it.comp) : null;
  if (t && t.rows) {
    for (const row of t.rows) {
      const iso = LSTV_SLUG[row.slug];
      if (!iso) { review.slugs.add(row.slug); continue; }
      for (const name of row.channels) {
        const k = classify(name, iso === 'INT' ? null : iso);
        if (k.kind === 'block') continue;
        if (k.kind === 'free') {
          const conf = k.entry.access === 'partial' ? 'möglich' : 'sicher';
          const cs = iso === 'INT' ? regionsOf(k.entry) : [iso];
          for (const c of cs) addOffer(m, k.entry.id, c, conf, 'livesoccertv');
        } else if (k.kind === 'pay') {
          addList(m.pay, iso, name);
        } else {
          addList(m.other, iso, name);
          bump(review.otherUnknown, `${name} [${iso}]`, label);
        }
      }
    }
  }

  // 3) Regeln (nur 'moeglich')
  const bd = berlin(m.kickoffUTC);
  for (const r of rules) {
    if (!r.comps.includes(m.comp)) continue;
    if (r.weekdays && !r.weekdays.includes(bd.weekday)) continue;
    if (r.germanOnly && !m.de) continue;
    const c = byId[r.channel];
    if (!c) { errors.push(`Regel verweist auf unbekannten Kanal ${r.channel}`); continue; }
    for (const country of r.countries || regionsOf(c)) addOffer(m, c.id, country, 'möglich', 'regel', r.note);
  }

  // 4) Manuelle Zusagen (Events selbst + Overrides)
  const manualOffers = [];
  if (m.manual) manualOffers.push(...(manual.events.find((e) => e.id === m.id)?.offers || []));
  const pairNorm = normName(`${m.home} ${m.away}`).join(' ');
  for (const ov of manual.overrides) {
    if (ov.comp !== m.comp || ov.date !== bd.date) continue;
    if (!ov.teams.every((t) => pairNorm.includes(normName(t).join(' ')))) continue;
    manualOffers.push(...ov.offers);
  }
  for (const o of manualOffers) {
    const c = byId[o.channel];
    if (!c) { errors.push(`Manueller Eintrag verweist auf unbekannten Kanal ${o.channel}`); continue; }
    for (const country of o.country ? [o.country] : regionsOf(c)) addOffer(m, c.id, country, o.conf || 'sicher', 'manuell');
  }
  if (m.manual) {
    const e = manual.events.find((x) => x.id === m.id);
    for (const p of e?.pay || []) addList(m.pay, 'DE', p);
  }
}

events.forEach(enrich);

// Spiele, die nur liveonsat kennt, als eigene Events aufnehmen: Boxkaempfe und EL/ECL-Spiele
// deutscher Klubs (OpenLigaDB pflegt die Europapokal-Spielplaene nur spieltagsweise nach).
const germanTok = new Set();
for (const f of fx.fixtures) if (['bl1', 'bl2'].includes(f.comp)) for (const t of [...normName(f.home), ...normName(f.away)]) if (t.length > 3 && t !== 'union') germanTok.add(t);
const isGermanClub = (n) => normName(n).some((t) => germanTok.has(t));
for (const it of los.items) {
  if (usedLos.has(it)) continue;
  const euro = (it.comp === 'uel' || it.comp === 'uecl') && (isGermanClub(it.home) || isGermanClub(it.away));
  if (it.comp !== 'box' && !euro) continue;
  const ko = Date.parse(it.kickoffUTC);
  if (ko < fromMs || ko > toMs) continue;
  const m = euro
    ? { id: `${it.comp}-los-${ko}-${normName(it.home)[0]}`, sport: 'football', comp: it.comp, kickoffUTC: it.kickoffUTC, home: it.home, away: it.away, stage: it.head.replace(/^.*- /, ''), de: true, offers: [], pay: {}, other: {} }
    : { id: `box-los-${ko}`, sport: 'boxing', comp: 'box', kickoffUTC: it.kickoffUTC, home: it.home, away: it.away, stage: it.head.replace(/^Professional Boxing - /, ''), de: false, offers: [], pay: {}, other: {} };
  enrich(m);
  events.push(m);
}

// EuroLeague: nur deutsche Spiele oder solche mit belegtem (nicht nur Regel-)Gratisangebot.
const final = events.filter((m) => m.comp !== 'el' || m.de || m.offers.some((o) => !(o.src.length === 1 && o.src[0] === 'regel')));
final.sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));

const out = {
  generatedAt: new Date(now).toISOString(),
  window: { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() },
  checked: reg.checked,
  comps: COMPS,
  countries: COUNTRY_NAMES,
  channels: Object.fromEntries(channels.map(({ re, match, ...c }) => [c.id, c])),
  matches: final.map((m) => ({
    id: m.id, sport: m.sport, comp: m.comp, ko: m.kickoffUTC, end: m.endUTC, tbc: m.tbc || undefined,
    home: m.home, away: m.away, stage: m.stage || undefined, venue: m.venue, de: m.de || undefined, note: m.note,
    offers: m.offers, pay: m.pay, other: m.other
  })),
  errors
};
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/matches.json'), JSON.stringify(out));

const top = (map, n) => [...map].sort((a, b) => b[1].n - a[1].n).slice(0, n).map(([k, v]) => ({ name: k, count: v.n, example: v.example }));
fs.writeFileSync(path.join(ROOT, 'data/review.json'), JSON.stringify({
  generatedAt: out.generatedAt,
  _doc: 'Pflege-Queue: Sender, die weder in channels.json noch in pay.json/blocklist.json stehen. ftaUnknown = laut liveonsat unverschluesselt - zuerst pruefen.',
  ftaUnknown: top(review.ftaUnknown, 100), otherUnknown: top(review.otherUnknown, 150), unknownSlugs: [...review.slugs], errors
}, null, 1));

const withFree = final.filter((m) => m.offers.some((o) => o.conf === 'sicher')).length;
log(`${final.length} Termine, ${withFree} mit sicherem Gratisangebot, ${errors.length} Fehler`);
if (errors.length) log(errors.join('\n'));
