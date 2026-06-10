// Datos de partido — combina campos de sportdb.dev y TheSportsDB
export interface Match {
  eventId?: string;
  tournamentId?: string;
  tournamentName?: string;
  round?: string;
  roundInfo?: { round?: string };
  stage?: string;
  tournament?: { name?: string };

  startDateTimeUtc?: string;
  startUtime?: string | number;   // Timestamp UNIX — variante 1
  startTime?: string | number;    // Timestamp UNIX — variante 2
  eventStartTime?: string | number;   // Timestamp UNIX — variante 3 (LaLiga)
  processedDate?: Date;

  homeName?: string;
  homeLogo?: string;
  homeScore?: string | number;     // string | number por inconsistencias entre APIs

  awayName?: string;
  awayLogo?: string;
  awayScore?: string | number;

  gameTime?: string;               // Minuto de juego en partidos en vivo
  eventStatus?: string;            // Estado crudo de la API ("FINISHED", "INPROGRESS"...)
}

// Fila de la tabla de clasificación — endpoint /standings de sportdb.dev
export interface Standing {
  rank: number | string;
  teamId?: string;
  teamName: string;
  points: number | string;
  matches: number | string;
  goalDiff: number | string;
  goals?: string;
  teamBadge?: string;
  teamLogo?: string;
}

// Perfil de equipo — endpoints de TheSportsDB
export interface Team {
  idTeam: string;
  id?: string;
  strTeam: string;
  strLeague?: string;

  strTeamBadge?: string;
  strBadge?: string;       // Escudo alternativo
  strStadiumThumb?: string;
  strTeamBanner?: string;
  strBanner?: string;      // Banner alternativo
  strFanart1?: string;
  strEquipment?: string;

  strStadium?: string;
  strDescriptionES?: string;
  strDescriptionEN?: string;
  intFormedYear?: string;
  strSport?: string;
  strTwitter?: string;
  strInstagram?: string;
  strYoutube?: string;
}

// Perfil de jugador — endpoints de TheSportsDB
export interface Player {
  idPlayer: string;
  strPlayer: string;
  strPosition?: string;
  strNationality?: string;

  strThumb?: string;
  strCutout?: string;
  strNumber?: string;
  strHeight?: string;
  strWeight?: string;

  strSport?: string;
  strTeam?: string;
  idTeam?: string;
  strBirthLocation?: string;
  dateBorn?: string;
  strDescriptionEN?: string;
  strDescriptionES?: string;

  strTwitter?: string;
  strInstagram?: string;
  strFacebook?: string;
  strYoutube?: string;
}

// Trofeo del palmarés de un jugador — endpoint lookuphonours de TheSportsDB
export interface PlayerHonour {
  idHonour?: string;
  strPlayer?: string;
  strTeam?: string;
  strHonour?: string;
  strSeason?: string;
}

// Equipo anterior del historial de traspasos — endpoint lookupformerteams de TheSportsDB
export interface FormerTeam {
  idFormerTeam?: string;
  strFormerTeam?: string;
  strTeamBadge?: string;
  strJoined?: string;
  strDeparted?: string;
  idTeam?: string;
}

// Estadística individual de un partido
export interface MatchStat {
  statName: string;
  homeValue: string | number;
  awayValue: string | number;
}

// Grupo de estadísticas por categoría (posesión, tiros, faltas...) 
export interface StatGroup {
  period: string;
  stats: MatchStat[];
}

// Opción del desplegable de equipos en la sección de Jugadores
export interface TeamOption {
  name: string;
  badge?: string;
}

// Detalles completos de un partido
export interface MatchDetails {
  lineups: any;          // Estructura variable según el partido
  stats: StatGroup[] | null;
  summary: any;          // Estructura variable según el partido
}

// Evento individual de un partido (gol, tarjeta, sustitución) 
export interface MatchEventItem {
  time: string;
  type: string;          // 'goal' | 'yellow' | 'red' | 'sub'
  mainName: string;
  subName?: string;
  homeScore?: string | number;
  awayScore?: string | number;
  isHome: boolean;
  reason?: string;       // "Penalti", "P.P." (propia puerta), etc.
}

// Eventos agrupados por fase del partido 
export interface MatchStageSummary {
  stageName: string;     // '1ER TIEMPO' | '2º TIEMPO'
  events: MatchEventItem[];
}