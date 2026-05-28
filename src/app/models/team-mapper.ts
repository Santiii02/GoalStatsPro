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

  'Bosnia & Herzegovina': 'Bosnia-Herzegovina',
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
  'Algeria': 'Argelia',
  'Belgium': 'Bélgica',
  'Bosnia & Herzegovina': 'Bosnia y Herzegovina',
  'Bosnia-Herzegovin': 'Bosnia y Herzegovina',
  'Brazil': 'Brasil',
  'Canada': 'Canadá',
  'Cape Verde': 'Cabo Verde',
  'Croatia': 'Croacia',
  'Curacao': 'Curazao',
  'Curaçao': 'Curazao',
  'Czech Republic': 'República Checa',
  'D.R. Congo': 'RD Congo',
  'DR Congo': 'RD Congo',
  'Egypt': 'Egipto',
  'England': 'Inglaterra',
  'France': 'Francia',
  'Germany': 'Alemania',
  'Haiti': 'Haití',
  'Iran': 'Irán',
  'Iraq': 'Irak',
  'Ivory Coast': 'Costa de Marfil',
  'Japan': 'Japón',
  'Jordan': 'Jordania',
  'Mexico': 'México',
  'Morocco': 'Marruecos',
  'Netherlands': 'Países Bajos',
  'New Zealand': 'Nueva Zelanda',
  'Norway': 'Noruega',
  'Panama': 'Panamá',
  'Saudi Arabia': 'Arabia Saudita',
  'Scotland': 'Escocia',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  'Spain': 'España',
  'Sweden': 'Suecia',
  'Switzerland': 'Suiza',
  'Tunisia': 'Túnez',
  'Turkey': 'Turquía',
  'USA': 'Estados Unidos',
  'United States': 'Estados Unidos'
};

  /*
   * TRADUCTOR DE POSICIONES (Inglés a Español)
   */
  export function translatePositionMapping(position: string): string {
    if (!position) return 'Desconocido';
    const pos = position.toLowerCase();

    // Porteros
    if (pos.includes('goalkeeper')) return 'Portero';

    // Defensas
    if (pos.includes('left-back') || pos === 'left back') return 'Lat. Izquierdo';
    if (pos.includes('right-back') || pos === 'right back') return 'Lat. Derecho';
    if (pos.includes('centre-back') || pos.includes('center back')) return 'Def. Central';
    if (pos.includes('defender') || pos.includes('back')) return 'Defensa';

    // Centrocampistas
    if (pos.includes('defensive midfield')) return 'Pivote';
    if (pos.includes('attacking midfield')) return 'Mediapunta';
    if (pos.includes('central midfield')) return 'Centrocampista';
    if (pos.includes('left midfield') || pos.includes('left midfielder')) return 'Int. Izquierdo';
    if (pos.includes('right midfield') || pos.includes('right midfielder')) return 'Int. Derecho';
    if (pos.includes('midfield')) return 'Centrocampista';

    // Delanteros
    if (pos.includes('left wing')) return 'Ext. Izquierdo';
    if (pos.includes('right wing')) return 'Ext. Derecho';
    if (pos.includes('centre-forward') || pos.includes('center forward') || pos.includes('striker')) return 'Delantero Centro';
    if (pos === 'winger') return 'Extremo'; 
    if (pos.includes('forward') || pos.includes('wing') || pos.includes('attacker')) return 'Delantero';

    // Si es una posición desconocida, devolvemos el original
    return position;
  }

  /*
   * POSICIÓN DEL JUGADOR
   */
  export function getPlayerRoleMapping(position: string): string {
    if (!position) return '';
    const pos = position.toLowerCase();

    if (pos.includes('goalkeeper')) return 'gk';
    if (pos.includes('back') || pos.includes('defender')) return 'df';
    if (pos.includes('midfield')) return 'mf'; 
    if (pos.includes('wing') || pos.includes('forward') || pos.includes('striker') || pos.includes('attacker')) return 'fw';

    return '';
  }