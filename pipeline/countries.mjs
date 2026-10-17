// Laendercodes (ISO2) mit deutschem Namen, plus Zuordnung der livesoccertv-Slugs und der
// Laenderhinweise in liveonsat-Sendernamen.

export const COUNTRY_NAMES = {
  DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', GB: 'Großbritannien', IE: 'Irland', IT: 'Italien', ES: 'Spanien',
  PT: 'Portugal', FR: 'Frankreich', NL: 'Niederlande', BE: 'Belgien', LU: 'Luxemburg', DK: 'Dänemark', NO: 'Norwegen',
  SE: 'Schweden', FI: 'Finnland', IS: 'Island', PL: 'Polen', CZ: 'Tschechien', SK: 'Slowakei', HU: 'Ungarn', HR: 'Kroatien',
  SI: 'Slowenien', RS: 'Serbien', BA: 'Bosnien-Herzegowina', ME: 'Montenegro', XK: 'Kosovo', AL: 'Albanien', MK: 'Nordmazedonien',
  RO: 'Rumänien', BG: 'Bulgarien', GR: 'Griechenland', CY: 'Zypern', TR: 'Türkei', UA: 'Ukraine', MD: 'Moldau', LV: 'Lettland',
  LT: 'Litauen', EE: 'Estland', MT: 'Malta', US: 'USA', CA: 'Kanada', MX: 'Mexiko', BR: 'Brasilien', AR: 'Argentinien',
  JP: 'Japan', ID: 'Indonesien', TH: 'Thailand', VN: 'Vietnam', PH: 'Philippinen', SG: 'Singapur', MY: 'Malaysia', MV: 'Malediven',
  MM: 'Myanmar', IN: 'Indien', AU: 'Australien', NZ: 'Neuseeland', SA: 'Saudi-Arabien', AE: 'VAE', QA: 'Katar', EG: 'Ägypten',
  MA: 'Marokko', TN: 'Tunesien', ZA: 'Südafrika', NG: 'Nigeria', GH: 'Ghana', KE: 'Kenia', CM: 'Kamerun', KZ: 'Kasachstan',
  MO: 'Macau', IL: 'Israel', GE: 'Georgien', AM: 'Armenien', AZ: 'Aserbaidschan', CN: 'China', KR: 'Südkorea', HK: 'Hongkong',
  DO: 'Dom. Republik', CO: 'Kolumbien', CL: 'Chile', PE: 'Peru'
};

// livesoccertv-Slug -> ISO2. Unbekannte Slugs werden ignoriert (landen in der Pruef-Queue).
export const LSTV_SLUG = {
  germany: 'DE', austria: 'AT', switzerland: 'CH', 'united-kingdom': 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  'northern-ireland': 'GB', ireland: 'IE', italy: 'IT', spain: 'ES', andorra: 'ES', portugal: 'PT', france: 'FR',
  netherlands: 'NL', belgium: 'BE', luxembourg: 'LU', denmark: 'DK', norway: 'NO', sweden: 'SE', finland: 'FI',
  iceland: 'IS', poland: 'PL', 'czech-republic': 'CZ', slovakia: 'SK', hungary: 'HU', croatia: 'HR', slovenia: 'SI',
  serbia: 'RS', 'bosnia-and-herzegovina': 'BA', montenegro: 'ME', kosovo: 'XK', albania: 'AL', macedonia: 'MK',
  romania: 'RO', bulgaria: 'BG', greece: 'GR', cyprus: 'CY', turkey: 'TR', ukraine: 'UA', moldova: 'MD', latvia: 'LV',
  lithuania: 'LT', estonia: 'EE', malta: 'MT', usa: 'US', canada: 'CA', mexico: 'MX', brazil: 'BR', argentina: 'AR',
  japan: 'JP', indonesia: 'ID', thailand: 'TH', vietnam: 'VN', philippines: 'PH', singapore: 'SG', malaysia: 'MY',
  maldives: 'MV', myanmar: 'MM', india: 'IN', australia: 'AU', 'new-zealand': 'NZ', 'saudi-arabia': 'SA',
  'united-arab-emirates': 'AE', qatar: 'QA', egypt: 'EG', morocco: 'MA', tunisia: 'TN', 'south-africa': 'ZA',
  nigeria: 'NG', ghana: 'GH', kenya: 'KE', cameroon: 'CM', kazakhstan: 'KZ', macau: 'MO', israel: 'IL', georgia: 'GE',
  armenia: 'AM', azerbaijan: 'AZ', china: 'CN', 'korea-republic': 'KR', 'hong-kong': 'HK', 'dominican-republic': 'DO',
  colombia: 'CO', chile: 'CL', peru: 'PE', international: 'INT'
};

// Laenderhinweis im liveonsat-Sendernamen (fuer Pay-/Sonstige-Gruppierung).
export const NAME_HINT = [
  [/Deutsch(land)?\b/i, 'DE'], [/Österreich|Austria/i, 'AT'], [/Schweiz|Swiss|Suisse/i, 'CH'], [/\b(UK|England|Great Britain|Scotland)\b/i, 'GB'],
  [/Ireland/i, 'IE'], [/Italia/i, 'IT'], [/España|Spain/i, 'ES'], [/Portugal/i, 'PT'], [/France/i, 'FR'], [/Nederland/i, 'NL'],
  [/Belgi(um|que|ë)/i, 'BE'], [/Danmark/i, 'DK'], [/Norge/i, 'NO'], [/Sverige/i, 'SE'], [/Suomi/i, 'FI'], [/Ísland/i, 'IS'],
  [/Polska/i, 'PL'], [/Czech/i, 'CZ'], [/Slovakia/i, 'SK'], [/Hrvatska/i, 'HR'], [/Srbija/i, 'RS'], [/BiH/i, 'BA'],
  [/Slovenija/i, 'SI'], [/Türkiye/i, 'TR'], [/Hellas|Greece/i, 'GR'], [/Israel/i, 'IL'], [/Romania/i, 'RO'], [/Bulgaria/i, 'BG'],
  [/Magyar|Hungary/i, 'HU'], [/Canada/i, 'CA'], [/\bUSA\b/i, 'US'], [/Brazil/i, 'BR'], [/Australia/i, 'AU'], [/Georgia/i, 'GE'],
  [/Armenia/i, 'AM'], [/Ukraine/i, 'UA'], [/Belarus/i, 'BY'], [/Malta/i, 'MT'], [/MENA/i, 'MENA'], [/Baltic/i, 'LV']
];
