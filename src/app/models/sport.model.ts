/*
 * INTERFAZ QUE REPRESENTA UN PARTIDO DE FÚTBOL.
 */
export interface Match {
  // IDENTIFICADORES

  /* --- ID único del evento --- */
  eventId?: string;

  /* --- ID del torneo --- */
  tournamentId?: string;

  /* --- Nombre del torneo --- */
  tournamentName?: string;

  /* --- Jornada --- */
  round?: string;

  /* --- Fecha y hora de inicio (ej: "2025-05-12T14:00:00") --- */
  startDateTimeUtc?: string;

  /* --- Timestamp UNIX (en segundos) del inicio del partido. --- */
  eventStartTime?: number | string;

  /*
   * Propiedad transitoria, calculado a partir de la fecha de la API. 
'  * Se utiliza para operaciones de filtrado, ordenación y formateo en la vista.
   */
  processedDate?: Date;

  // EQUIPO LOCAL (HOME)
  /* --- Nombre del equipo local --- */
  homeName?: string;

  /* --- URL absoluta del logo/escudo del equipo local --- */
  homeLogo?: string;

  /* --- Marcador del equipo local. Tipo unión (string | number) para manejar estados de API inconsistentes. --- */
  homeScore?: string | number;

  // EQUIPO VISITANTE (AWAY)
  /* --- Nombre del equipo visitante --- */
  awayName?: string;

  /* --- URL absoluta del logo/escudo del equipo visitante --- */
  awayLogo?: string;

  /* --- Marcador del equipo visitante --- */
  awayScore?: string | number;

  // ESTADO Y METADATOS
  /* --- Minuto actual de juego --- */
  gameTime?: string;

  /* --- Estado actual del evento (ej: "Finished", "Scheduled", "Live") --- */
  eventStatus?: string;
}


/*
 * INTERFAZ QUE REPRESENTA UNA FILA EN LA TABLA DE CLASIFICACIÓN.
 */
export interface Standing {
  /* --- Posición actual en la tabla (Ranking) --- */
  rank: number | string;

  /* --- Identificador único del equipo --- */
  teamId?: string;

  /* --- Nombre del equipo --- */
  teamName: string;

  /* --- Puntos acumulados en la competición --- */
  points: number | string;

  /* --- Cantidad de partidos jugados hasta la fecha --- */
  matches: number | string;

  /* --- Diferencia de goles (Goles a favor - Goles en contra) --- */
  goalDiff: number | string;

  /* --- Representación en string del balance de goles (ej: "45:20") --- */
  goals?: string;

  /* --- Logo del equipo --- */
  teamBadge?: string;
  teamLogo?: string;
}

/*
 * INTERFAZ QUE REPRESENTA UN EQUIPO.
 */
export interface Team {
  /* --- Identificador único del equipo --- */
  idTeam: string;

  /* --- Identificador único del equipo --- */
  id?: string;

  /* --- Nombre del equipo --- */
  strTeam: string;

  /* --- Logo del equipo --- */
  strTeamBadge: string;

  /* --- Logo del equipo --- */
  strBadge?: string;

  /* --- Nombre de la liga --- */
  strLeague: string;

  /* --- Estadio del equipo --- */
  strStadium: string;

  /* --- Descripción del equipo --- */
  strDescriptionES?: string;

  /* --- Año de creación --- */
  intFormedYear?: string;

  /* --- Deporte --- */
  strSport?: string;
}
