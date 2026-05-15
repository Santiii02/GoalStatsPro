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
  'Bayern': 'Bayern Munich'
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