/*
 * DICCIONARIO DE TRADUCCIÓN DE EQUIPOS
 * Clave: El nombre que nos envía Flashscore
 * Valor: El nombre exacto que necesita TheSportsDB para encontrarlo
 */

export const TEAM_NAME_MAPPER: Record<string, string> = {
  'Betis': 'Real Betis',
  'Celta': 'Celta de Vigo',
  'Alaves': 'Deportivo Alavés',
  'Atl. Madrid': 'Atlético Madrid',
  'Ath Bilbao': 'Athletic Bilbao',
  'Oviedo': 'Real Oviedo',

  'Man City': 'Manchester City',
  'Man United': 'Manchester United',
  'PSG': 'Paris SG',
  'Bayern': 'Bayern Munich',

  'Curacao': 'Curaçao',
  'D.R. Congo': 'DR Congo',
};

/*
 * NORMALIZACIÓN DE NOMBRES (Flashscore -> TheSportsDB)
 */
export function normalizeTeamName(flashscoreName: string): string {
  if (!flashscoreName) return '';

  // Quitamos espacios extra por si acaso
  const cleanName = flashscoreName.trim();

  // Devolvemos el valor o el original si no está en el diccionario
  return TEAM_NAME_MAPPER[cleanName] || cleanName;
}


/*
 * NORMALIZACIÓN DE NOMBRES (TheSportsDB -> Flashscore)
 */
export function getFlashscoreName(sportsDbName: string): string {
  if (!sportsDbName) return '';

  // Quitamos espacios extra por si acaso
  const cleanName = sportsDbName.trim();

  // Buscamos qué clave tiene asignado este valor
  const flashscoreKey = Object.keys(TEAM_NAME_MAPPER).find(
    key => TEAM_NAME_MAPPER[key] === cleanName
  );

  // Devolvemos la clave o el original si no está en el diccionario
  return flashscoreKey || cleanName;
}

/* --- Traducción de nombres de países --- */
export function translateTeamName(englishName: string): string {
  if (!englishName) return '';
  const cleanName = englishName.trim();
  return COUNTRY_TRANSLATIONS[cleanName] || cleanName;
}

const COUNTRY_TRANSLATIONS: Record<string, string> = {
  'Albania': 'Albania',
  'Algeria': 'Argelia',
  'Andorra': 'Andorra',
  'Armenia': 'Armenia',
  'Austria': 'Austria',
  'Azerbaijan': 'Azerbaiyán',
  'Belarus': 'Bielorrusia',
  'Belgium': 'Bélgica',
  'Bosnia & Herzegovina': 'Bosnia y Herzegovina',
  'Bosnia-Herzegovin': 'Bosnia y Herzegovina',
  'Brazil': 'Brasil',
  'Bulgaria': 'Bulgaria',
  'Cameroon': 'Camerún',
  'Canada': 'Canadá',
  'Cape Verde': 'Cabo Verde',
  'Chile': 'Chile',
  'Colombia': 'Colombia',
  'Croatia': 'Croacia',
  'Curacao': 'Curazao',
  'Curaçao': 'Curazao',
  'Cyprus': 'Chipre',
  'Czech Republic': 'República Checa',
  'D.R. Congo': 'RD Congo',
  'DR Congo': 'RD Congo',
  'Denmark': 'Dinamarca',
  'Ecuador': 'Ecuador',
  'Egypt': 'Egipto',
  'England': 'Inglaterra',
  'Equatorial Guinea': 'Guinea Ecuatorial',
  'Estonia': 'Estonia',
  'Finland': 'Finlandia',
  'France': 'Francia',
  'Georgia': 'Georgia',
  'Germany': 'Alemania',
  'Ghana': 'Ghana',
  'Greece': 'Grecia',
  'Haiti': 'Haití',
  'Hungary': 'Hungría',
  'Iceland': 'Islandia',
  'Iran': 'Irán',
  'Iraq': 'Irak',
  'Ireland': 'Irlanda',
  'Italy': 'Italia',
  'Ivory Coast': 'Costa de Marfil',
  'Japan': 'Japón',
  'Jordan': 'Jordania',
  'Kazakhstan': 'Kazajistán',
  'Latvia': 'Letonia',
  'Lithuania': 'Lituania',
  'Luxembourg': 'Luxemburgo',
  'Macedonia': 'Macedonia del Norte',
  'Mexico': 'México',
  'Moldova': 'Moldavia',
  'Montenegro': 'Montenegro',
  'Morocco': 'Marruecos',
  'Netherlands': 'Países Bajos',
  'New Zealand': 'Nueva Zelanda',
  'Nigeria': 'Nigeria',
  'North Macedonia': 'Macedonia del Norte',
  'Northern Ireland': 'Irlanda del Norte',
  'Norway': 'Noruega',
  'Panama': 'Panamá',
  'Peru': 'Perú',
  'Poland': 'Polonia',
  'Portugal': 'Portugal',
  'Republic of Ireland': 'República de Irlanda',
  'Romania': 'Rumanía',
  'Russia': 'Rusia',
  'San Marino': 'San Marino',
  'Saudi Arabia': 'Arabia Saudita',
  'Scotland': 'Escocia',
  'Senegal': 'Senegal',
  'Serbia': 'Serbia',
  'Slovakia': 'Eslovaquia',
  'Slovenia': 'Eslovenia',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  'Spain': 'España',
  'Sweden': 'Suecia',
  'Switzerland': 'Suiza',
  'Tunisia': 'Túnez',
  'Turkey': 'Turquía',
  'Ukraine': 'Ucrania',
  'United Arab Emirates': 'Emiratos Árabes Unidos',
  'United States': 'Estados Unidos',
  'Uruguay': 'Uruguay',
  'USA': 'Estados Unidos',
  'Wales': 'Gales'
};

/*
  * TRADUCTOR DE POSICIONES (Inglés a Español)
  */
export function translatePositionMapping(position: string): string {
  if (!position) return 'Desconocido';
  const pos = position.toLowerCase();

  // Buscamos la primera regla donde alguna de sus "keys" esté incluida en la posición
  const match = POSITION_TRANSLATIONS.find(entry =>
    entry.keys.some(key => pos.includes(key))
  );

  return match ? match.label : position;
}

const POSITION_TRANSLATIONS = [
  { keys: ['goalkeeper'], label: 'Portero' },
  { keys: ['left-back', 'left back'], label: 'Lat. Izquierdo' },
  { keys: ['right-back', 'right back'], label: 'Lat. Derecho' },
  { keys: ['centre-back', 'center back'], label: 'Def. Central' },
  { keys: ['defender', 'back'], label: 'Defensa' },
  { keys: ['defensive midfield'], label: 'Pivote' },
  { keys: ['attacking midfield'], label: 'Mediapunta' },
  { keys: ['central midfield'], label: 'Centrocampista' },
  { keys: ['left midfield', 'left midfielder'], label: 'Int. Izquierdo' },
  { keys: ['right midfield', 'right midfielder'], label: 'Int. Derecho' },
  { keys: ['midfield'], label: 'Centrocampista' },
  { keys: ['left wing'], label: 'Ext. Izquierdo' },
  { keys: ['right wing'], label: 'Ext. Derecho' },
  { keys: ['centre-forward', 'center forward', 'striker'], label: 'Delantero Centro' },
  { keys: ['winger'], label: 'Extremo' },
  { keys: ['forward', 'wing', 'attacker'], label: 'Delantero' }
];

/*
  * POSICIÓN DEL JUGADOR
  */
export function getPlayerRoleMapping(position: string): string {
  if (!position) return '';
  const pos = position.toLowerCase();

  // Misma lógica de búsqueda
  const match = ROLE_MAPPINGS.find(entry =>
    entry.keys.some(key => pos.includes(key))
  );

  return match ? match.role : '';
}

const ROLE_MAPPINGS = [
  { keys: ['goalkeeper'], role: 'gk' },
  { keys: ['back', 'defender'], role: 'df' },
  { keys: ['midfield'], role: 'mf' },
  { keys: ['wing', 'forward', 'striker', 'attacker'], role: 'fw' }
];