# Stream-Kalender

Android-App (WebView via [apk-builder](../apk-builder)): Kalender für Top-Sportevents
(Fußball-Bundesliga 1–3, DFB-Pokal, CL/EL/ECL, Länderspiele, EuroLeague/EuroCup,
Basketball-/Handball-Nationalteams, Handball-WM 2027, Box-WM, Darts-WM). Pro Spiel zeigt
sie, wo es **legal und kostenlos** läuft, und zwar im gewählten Land. Gedacht für Deutsche zu
Hause und im Urlaub. Vorbild sind die mydealz-Listen von „WukderFuchs“, hier automatisiert.

**Harte Regeln**: nur offizielle Sender, Mediatheken und YouTube-Kanäle der Rechteinhaber.
Keine Piratenstreams, keine Anleitungen zum Umgehen von Geosperren (keine VPN-Tipps,
keine App-Store-Länder-Tricks). Kanäle ohne Rechte (iranische/afghanische Sat-Sender)
stehen in `registry/blocklist.json` und werden nie angezeigt.

## Aufbau

- `pipeline/` erzeugt `data/matches.json` (Node ≥ 20, keine Abhängigkeiten).
  - `fixtures.mjs`: OpenLigaDB (`bl1/bl2/bl3/dfb/ucl/uel<Jahr>/uecl<Jahr>/DFBN`) und EuroLeague-API v2.
  - `liveonsat.mjs`: Sender pro Spiel, die Hauptquelle. Die Klasse `chan_live_free` heißt
    nur „unverschlüsselt per Sat“, **nicht** „legal frei“.
  - `livesoccertv.mjs`: liefert Land → Sender, ist aber **standardmäßig aus** (`--lstv`).
    Die Seite weist automatisierte Clients mit 403 ab, und das umgehen wir nicht.
  - `build.mjs`: Abgleich der Spiele über Wettbewerb, Anstoß ±3 h und Teamnamen-Ähnlichkeit
    (`util.mjs` `pairScore`). Danach Klassifizierung jedes Sendernamens:
    blocklist → channels (frei) → pay → sonst „other“ und Prüf-Queue.
- `registry/` ist **kuratiert**. Das ist der eigentliche Wert des Projekts:
  - `channels.json`: das einzige, was die App als „frei“ zeigt. `access: partial` und
    `country: "*"` (Plattformen mit Länderliste in `regions`) ergeben immer „möglich“.
  - `rules.json`: Wettbewerb → Sender ohne Spielgenauigkeit, immer „möglich“.
  - `manual-events.json`: Termine ohne API (Handball, Basketball-Quali, Boxen, Darts) und
    `overrides` (spielgenaue Free-TV-Zusagen, z. B. Sat.1-Spiele, Pokal-Spiele bei ARD/ZDF).
  - `pay.json`, `blocklist.json`.
- `data/review.json`: Pflege-Queue mit unbekannten Sendernamen. `ftaUnknown` zuerst prüfen.
- `web/index.html`: die ganze App (HTML/CSS/JS inline). Sie lädt die raw-URL von GitHub,
  fällt sonst auf die mitgelieferte `data/matches.json` zurück und cacht in localStorage
  (`streamkal.*.v1`).
- `.github/workflows/update.yml`: läuft 2× täglich, baut die Daten und committet `data/`.

## Befehle

```powershell
node pipeline\build.mjs            # Daten neu bauen (~1 min, liveonsat mit 3 s Abstand je Seite)
node pipeline\build.mjs --no-los   # nur APIs + Regeln (schnell, für UI-Tests)
node tools\serve.mjs               # http://localhost:8110/web/ (nicht file://, sonst kein localStorage)
.\build.ps1 -Release               # APK; danach nach dist\stream-kalender-<version>.apk kopieren
.\build.ps1 -VersionName "1.1" -VersionCode 2 -Release -Install
```

## Ausfälle (seit v1.4, 2026-11-10)

`build.mjs` legt den vorherigen `data/matches.json` daneben und dünnt ihn nie aus:

- Spielplan-Quelle eines Wettbewerbs nicht abrufbar → dessen Termine werden unverändert
  übernommen. liveonsat liefert für einen Wettbewerb nichts mehr, hatte dort zuletzt aber
  Sender → die spielgenauen Angebote bleiben. Beides steht in `errors`, Exitcode **2**.
- Gar keine Termine oder Einbruch unter die Hälfte → nichts wird geschrieben, Exitcode **1**.
- Der Workflow committet bei 0 und 2 und meldet den Lauf bei 1 und 2 danach als
  fehlgeschlagen (GitHub schickt dann eine Mail). Ein grüner Lauf heißt also: alle Quellen da.
- Ausfälle testen: `SK_FAIL=<Regex>` lässt passende Adressen scheitern, z. B.
  `SK_FAIL=liveonsat node pipeline/build.mjs`. **Vorher `data/` sichern**, der Lauf schreibt.
- Zuordnung liveonsat → Termin läuft über `assignOnce()`: jeder Eintrag nur einmal, die
  ähnlichsten Paare zuerst. Wer an `pairScore` dreht, vergleicht vorher/nachher, wie viele
  Termine liveonsat-Sender haben (zuletzt 52 von 242, keiner verloren).
- Die Saison kommt aus dem Datum (`seasonOf()`, Wechsel am 1. Juli), auch in den
  OpenLigaDB-Kürzeln `uel<Jahr>` / `uecl<Jahr>`. Ob OpenLigaDB die Kürzel 2027 wieder so
  nennt, im Juli 2027 prüfen.
- **3. Liga:** liveonsat hat dafür keine Einzelseite (nur `-all-football`, `-bundesliga1`,
  `-bundesliga2`, `-dfb-Pokal`). Aus GitHub Actions kommt die Sammelseite mit 403 zurück,
  von zu Hause aus nicht. Drittliga-Sender gibt es deshalb nur nach einem lokalen Lauf oder
  über `rules.json` / `overrides`.
- App: der mitgelieferte Datenstand kommt als `data/matches.js` (`window.BUNDLED_DATA`, von
  `build.ps1` erzeugt), nicht per `fetch` – das scheitert unter `file:///android_asset`.
  Am Testserver fehlt die Datei, der 404 in der Konsole ist normal.

## Pflege (wiederkehrend)

1. `data/review.json` ansehen. Neue legale Free-Sender in `channels.json` aufnehmen, Pay-Sender
   in `pay.json`, Sender ohne Rechte in `blocklist.json`.
2. Free-TV-Ansagen (Sat.1/RTL-Bundesligaspiele, ARD/ZDF-Pokal, MagentaSport-Gratisspiele,
   Handball-WM-Anwurfzeiten) als `overrides` bzw. `events` nachtragen.
3. Bei Saisonwechsel die Rechte neu recherchieren. **Ab 2027/28** ändern sich alle UEFA-Rechte
   (DE: Paramount+/Amazon, SRG und CazéTV raus), das betrifft `rules.json`.
4. `checked` in `channels.json` aktualisieren.

## Offene Punkte

- BBL hat keine freie API (`api.basketball-bundesliga.de` braucht den Zugangsschlüssel der
  Website, den wir nicht abgreifen). BBL-Free-TV-Spiele deshalb manuell in `manual-events.json`.
- Die IHF-„How to watch“-Liste zur Handball-WM 2027 erscheint im Januar. Dann die Länder
  bei den WM-Events ergänzen.
- Ob liveonsat aus GitHub-Actions-IPs erreichbar ist, nach dem ersten Workflow-Lauf in
  `data/review.json` → `errors` prüfen.
- ARD-Programm-API (`programm-api.ard.de`) als zusätzliche DE-Bestätigung ist noch nicht eingebaut.
