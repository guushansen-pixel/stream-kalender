// Spielplaene aus freien APIs: OpenLigaDB (Fussball) und EuroLeague v2 (Basketball).
import { get, normName } from './util.mjs';

const SEASON = 2026;

// OpenLigaDB-Kuerzel -> unsere Wettbewerbs-ID. germanOnly: nur Spiele mit deutschem Team.
const OLDB = [
  { shortcut: 'bl1', comp: 'bl1' },
  { shortcut: 'bl2', comp: 'bl2' },
  { shortcut: 'bl3', comp: 'bl3' },
  { shortcut: 'dfb', comp: 'dfb' },
  { shortcut: 'ucl', comp: 'ucl' },
  { shortcut: 'uel2026', comp: 'uel', season: '', germanOnly: true },
  { shortcut: 'uecl2026', comp: 'uecl', season: '', germanOnly: true },
  { shortcut: 'DFBN', comp: 'nt' }
];

// Deutsche Klubs in EuroLeague/EuroCup (Namensbestandteile, wie die API sie liefert).
const GERMAN_BASKETBALL = /bayern|alba|ulm|chemnitz|rostock|frankfurt|bonn|bamberg|oldenburg|wurzburg|ludwigsburg|vechta|hamburg|braunschweig|heidelberg|bayreuth|gottingen/i;

export async function fetchFixtures({ fromMs, toMs, log }) {
  const out = [];
  const errors = [];

  // Deutsche Teams kennen wir aus den drei Ligen; damit erkennen wir sie in den UEFA-Wettbewerben.
  const germanTokens = new Set();
  const leagueCache = {};
  for (const l of OLDB) {
    const url = `https://api.openligadb.de/getmatchdata/${l.shortcut}${l.season === '' ? '' : '/' + SEASON}`;
    try {
      leagueCache[l.shortcut] = await get(url, { json: true, gapMs: 500 });
      if (['bl1', 'bl2', 'bl3'].includes(l.comp)) {
        for (const m of leagueCache[l.shortcut]) for (const t of [m.team1, m.team2]) normName(t.teamName).forEach((x) => germanTokens.add(x));
      }
    } catch (e) {
      errors.push(`OpenLigaDB ${l.shortcut}: ${e.message}`);
      leagueCache[l.shortcut] = [];
    }
  }
  // Tokens, die auch auslaendische Klubs tragen (Union Saint-Gilloise, ...), zaehlen nicht.
  for (const t of ['union', 'st']) germanTokens.delete(t);
  const isGerman = (name) => /deutschland|germany/i.test(name) || normName(name).some((t) => germanTokens.has(t) && t.length > 3);

  for (const l of OLDB) {
    for (const m of leagueCache[l.shortcut]) {
      const ko = Date.parse(m.matchDateTimeUTC);
      if (!(ko >= fromMs && ko <= toMs)) continue;
      const home = m.team1.teamName, away = m.team2.teamName;
      const de = l.comp === 'nt' || ['bl1', 'bl2', 'bl3', 'dfb'].includes(l.comp) || isGerman(home) || isGerman(away);
      if (l.germanOnly && !de) continue;
      out.push({
        id: `${l.comp}-${m.matchID}`, sport: 'football', comp: l.comp, kickoffUTC: new Date(ko).toISOString(),
        home, away, stage: m.group?.groupName || '', de
      });
    }
  }
  log(`OpenLigaDB: ${out.length} Spiele im Zeitfenster`);

  // EuroLeague (E) und EuroCup (U). EuroLeague: alle Spiele holen, gefiltert wird in build.mjs
  // (deutsches Team ODER freies Angebot). EuroCup nur mit deutschem Team.
  for (const [code, comp] of [['E', 'el'], ['U', 'ec']]) {
    try {
      const j = await get(`https://api-live.euroleague.net/v2/competitions/${code}/seasons/${code}${SEASON}/games`, { json: true, gapMs: 500 });
      let n = 0;
      for (const g of j.data || []) {
        const ko = Date.parse(g.utcDate);
        if (!(ko >= fromMs && ko <= toMs)) continue;
        const home = g.local?.club?.name, away = g.road?.club?.name;
        const de = GERMAN_BASKETBALL.test(home) || GERMAN_BASKETBALL.test(away);
        if (comp === 'ec' && !de) continue;
        out.push({
          id: `${comp}-${g.gameCode}`, sport: 'basketball', comp, kickoffUTC: new Date(ko).toISOString(),
          tbc: g.confirmedHour === false, home, away, stage: g.roundName || '', de
        });
        n++;
      }
      log(`EuroLeague-API ${code}: ${n} Spiele`);
    } catch (e) {
      errors.push(`EuroLeague ${code}: ${e.message}`);
    }
  }
  return { fixtures: out, errors };
}
