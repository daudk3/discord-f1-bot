/**
 * Nationality / demonym / country name → flag emoji mapping.
 *
 * Uses Unicode regional indicator symbols to produce flag emoji.
 * Handles both demonyms ("British", "Dutch") and country names ("United Kingdom", "Netherlands")
 * as f1api.dev nationality values may use either form.
 */

/** Map of lowercase nationality/demonym/country → ISO 3166-1 alpha-2 code */
const NATIONALITY_TO_ISO: Record<string, string> = {
  // Common F1 nationalities — demonyms
  british: 'GB',
  english: 'GB',
  scottish: 'GB',
  welsh: 'GB',
  dutch: 'NL',
  monegasque: 'MC',
  thai: 'TH',
  australian: 'AU',
  french: 'FR',
  spanish: 'ES',
  canadian: 'CA',
  american: 'US',
  italian: 'IT',
  german: 'DE',
  japanese: 'JP',
  chinese: 'CN',
  finnish: 'FI',
  danish: 'DK',
  mexican: 'MX',
  brazilian: 'BR',
  argentine: 'AR',
  argentinian: 'AR',
  austrian: 'AT',
  swiss: 'CH',
  belgian: 'BE',
  portuguese: 'PT',
  polish: 'PL',
  russian: 'RU',
  swedish: 'SE',
  norwegian: 'NO',
  colombian: 'CO',
  venezuelan: 'VE',
  indian: 'IN',
  indonesian: 'ID',
  malaysian: 'MY',
  singaporean: 'SG',
  'south african': 'ZA',
  irish: 'IE',
  hungarian: 'HU',
  czech: 'CZ',
  romanian: 'RO',
  korean: 'KR',
  'south korean': 'KR',
  chilean: 'CL',
  peruvian: 'PE',
  uruguayan: 'UY',
  ecuadorian: 'EC',
  turkish: 'TR',
  greek: 'GR',
  estonian: 'EE',
  latvian: 'LV',
  lithuanian: 'LT',
  filipino: 'PH',
  emirati: 'AE',
  saudi: 'SA',
  qatari: 'QA',
  bahraini: 'BH',
  kuwaiti: 'KW',
  israeli: 'IL',

  // Country names
  'united kingdom': 'GB',
  'great britain': 'GB',
  uk: 'GB',
  netherlands: 'NL',
  holland: 'NL',
  monaco: 'MC',
  thailand: 'TH',
  australia: 'AU',
  france: 'FR',
  spain: 'ES',
  canada: 'CA',
  'united states': 'US',
  'united states of america': 'US',
  us: 'US',
  usa: 'US',
  italy: 'IT',
  germany: 'DE',
  japan: 'JP',
  china: 'CN',
  finland: 'FI',
  denmark: 'DK',
  mexico: 'MX',
  brazil: 'BR',
  argentina: 'AR',
  austria: 'AT',
  switzerland: 'CH',
  belgium: 'BE',
  portugal: 'PT',
  poland: 'PL',
  russia: 'RU',
  sweden: 'SE',
  norway: 'NO',
  colombia: 'CO',
  venezuela: 'VE',
  india: 'IN',
  indonesia: 'ID',
  malaysia: 'MY',
  singapore: 'SG',
  'south africa': 'ZA',
  ireland: 'IE',
  hungary: 'HU',
  'czech republic': 'CZ',
  czechia: 'CZ',
  romania: 'RO',
  'south korea': 'KR',
  korea: 'KR',
  chile: 'CL',
  peru: 'PE',
  uruguay: 'UY',
  ecuador: 'EC',
  turkey: 'TR',
  'türkiye': 'TR',
  greece: 'GR',
  estonia: 'EE',
  latvia: 'LV',
  lithuania: 'LT',
  philippines: 'PH',
  'united arab emirates': 'AE',
  uae: 'AE',
  'saudi arabia': 'SA',
  qatar: 'QA',
  bahrain: 'BH',
  kuwait: 'KW',
  israel: 'IL',
  'new zealand': 'NZ',
  'new zealander': 'NZ',
};

/**
 * Convert an ISO 3166-1 alpha-2 code to a flag emoji using regional indicator symbols.
 * E.g. "GB" → "🇬🇧"
 */
function isoToFlag(iso: string): string {
  return [...iso.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

/**
 * Get a flag emoji for a nationality string.
 * Returns empty string if the nationality cannot be mapped.
 *
 * @param nationality - A nationality demonym or country name (e.g. "British", "Netherlands")
 */
export function nationalityToFlag(nationality: string | undefined | null): string {
  if (!nationality) return '';
  const iso = NATIONALITY_TO_ISO[nationality.toLowerCase().trim()];
  if (!iso) return '';
  return isoToFlag(iso);
}

/**
 * Prepend a flag emoji to a driver display name based on nationality.
 * Returns the name unchanged if nationality is missing or unmappable.
 *
 * @param nationality - The driver's nationality string from f1api.dev
 * @param name - The driver display name or short code
 */
export function flaggedName(nationality: string | undefined | null, name: string): string {
  const flag = nationalityToFlag(nationality);
  return flag ? `${flag} ${name}` : name;
}
