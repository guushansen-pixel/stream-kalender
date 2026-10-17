// Gemeinsame Helfer der Pipeline: hoefliches Fetchen, Teamnamen-Abgleich, Berliner Zeit.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 stream-kalender';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pro Host mindestens `gapMs` zwischen zwei Requests - liveonsat und livesoccertv
// haben keine Nutzungsbedingungen veroeffentlicht, also bewusst sparsam.
const lastHit = new Map();
export async function get(url, { json = false, gapMs = 3000, headers = {} } = {}) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) || 0) + gapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de,en;q=0.8', ...headers } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return json ? res.json() : res.text();
}

// Englische, deutsche und Originalschreibweisen auf ein gemeinsames Token abbilden,
// damit "FC Bayern Muenchen", "Bayern Munich" und "Bayern Muenchen" gleich aussehen.
const ALIAS = {
  munich: 'munchen', muenchen: 'munchen', cologne: 'koln', koeln: 'koln', nuremberg: 'nurnberg',
  nuernberg: 'nurnberg', gladbach: 'monchengladbach', mgladbach: 'monchengladbach', "m'gladbach": 'monchengladbach',
  monchengladbach: 'monchengladbach', hamburger: 'hamburg', dusseldorf: 'dusseldorf', duesseldorf: 'dusseldorf',
  germany: 'deutschland', netherlands: 'niederlande', holland: 'niederlande', serbia: 'serbien', greece: 'griechenland',
  latvia: 'lettland', poland: 'polen', belgium: 'belgien', sweden: 'schweden', slovakia: 'slowakei',
  tunisia: 'tunesien', olympiacos: 'olympiacos', olympiakos: 'olympiacos', olympiacós: 'olympiacos', piraeus: 'olympiacos',
  fenerbahce: 'fenerbahce', besiktas: 'besiktas', lisbon: 'lissabon', lisboa: 'lissabon', prague: 'prag', praha: 'prag',
  turin: 'turin', torino: 'turin', milano: 'mailand', milan: 'mailand', inter: 'inter', napoli: 'neapel', naples: 'neapel',
  rome: 'rom', roma: 'rom', bruges: 'brugge', brugge: 'brugge', copenhagen: 'kopenhagen', kobenhavn: 'kopenhagen',
  athens: 'athen', belgrade: 'belgrad', beograd: 'belgrad', zvezda: 'belgrad', crvena: 'belgrad'
};
const STOP = new Set(['fc', 'sv', 'vfl', 'vfb', 'tsg', 'sc', 'bsc', 'fsv', 'ssv', 'spvgg', 'sg', 'tsv', 'bc', 'cf', 'ac', 'as',
  'ss', 'ssc', 'afc', 'cd', 'ud', 'rc', 'rcd', 'ca', 'club', 'de', 'der', 'the', 'and', 'e', 'v', '1', '04', '05', '09', '96', '98',
  '1846', '1860', '1899', '1900', '1910', 'borussia', 'eintracht', 'bayer', 'rasenballsport', 'olympique', 'sporting', 'real',
  'atletico', 'united', 'city', 'hotspur', 'basketball', 'basket', 'bk', 'kk', 'mozzart', 'bet', 'tel', 'aviv', 'bc']);

export function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ALIAS[t] || ALIAS[t.replace(/'/g, '')] || t.replace(/'/g, ''))
    .filter((t) => !STOP.has(t));
}

function tokenScore(a, b) {
  let s = 0;
  for (const x of a) {
    for (const y of b) {
      if (x === y) { s += 2; break; }
      if (x.length >= 5 && y.length >= 5 && (x.startsWith(y.slice(0, 5)) || y.startsWith(x.slice(0, 5)))) { s += 1; break; }
    }
  }
  return s;
}

// Gesamtaehnlichkeit zweier Paarungen; Heim/Gast vertauscht zaehlt halb.
export function pairScore(h1, a1, h2, a2) {
  const [x1, y1, x2, y2] = [h1, a1, h2, a2].map(normName);
  const straight = tokenScore(x1, x2) + tokenScore(y1, y2);
  const swapped = (tokenScore(x1, y2) + tokenScore(y1, x2)) / 2;
  return Math.max(straight, swapped);
}

// Datum (YYYY-MM-DD) und Wochentag (0 = Sonntag) in Berliner Zeit.
const berlinFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function berlin(isoOrMs) {
  const parts = Object.fromEntries(berlinFmt.formatToParts(new Date(isoOrMs)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: WD[parts.weekday] };
}

export const decodeEntities = (s) => String(s)
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
