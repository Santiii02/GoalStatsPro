/*
 * SERVICIO PARA CONSUMIR LAS APIS DE SPORTDB Y FLASHSCORE
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, timer, forkJoin, from } from 'rxjs';
import { map, catchError, tap, retry, concatMap, toArray, delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Match, Standing, Team } from '../models/sport.model';
import { normalizeTeamName } from '../models/team-mapper';

@Injectable({
  providedIn: 'root'
})
export class SportDbService {
  /* --- Inyección de dependencias --- */
  private readonly http = inject(HttpClient);

  /* --- Temporada actual --- */
  private readonly CURRENT_SEASON = '2025-2026';

  /* --- URL base --- */
  private readonly baseUrl = environment.apiBaseUrl;

  /* --- Prefijo de rutas API --- */
  private readonly LALIGA_BASE = `/api/flashscore/football/spain:176/laliga:QVmLl54o`;
  private readonly LALIGA_PREFIX = `${this.LALIGA_BASE}/${this.CURRENT_SEASON}`;

  private readonly WORLD_CUP_BASE = '/api/flashscore/football/world:8/world-cup:lvUBR5F8';
  private readonly WORLD_CUP_PREFIX = `${this.WORLD_CUP_BASE}/2026`;
  private readonly SPORTSDB_PREFIX = '/api/thesportsdb';

  /* --- Constantes de caché --- */
  private readonly CACHE_KEYS = {
    LIVE: 'goalstats_live',
    LALIGA_LIVE: 'goalstats_laliga_live',
    WC_LIVE: 'goalstats_wc_live',
    STANDINGS: `goalstats_standings_${this.CURRENT_SEASON}`,
    FIXTURES: `goalstats_fixtures_${this.CURRENT_SEASON}`,
    RESULTS: `goalstats_results_${this.CURRENT_SEASON}`,
    MATCH_DETAIL_PREFIX: 'goalstats_match_details_',
    TEAM_FORM_PREFIX: 'goalstats_team_form_',
    WC_STANDINGS: 'goalstats_wc_standings',
    WC_FIXTURES: 'goalstats_wc_fixtures',
    WC_RESULTS: 'goalstats_wc_results'
  };

  /* --- Tiempos de vida para la caché en milisegundos --- */
  private readonly CACHE_TTL = {
    LIVE: 5 * 60 * 1000,        // 5 minuto (Datos volátiles)
    STATIC: 6 * 60 * 60 * 1000  // 6 horas (Datos estáticos como calendarios)
  };

  /* --- Genera los headers comunes para las peticiones sin clave --- */
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  /*
   * GESTIÓN DE CACHÉ
   */

  /* --- Método que recupera un recurso del almacenamiento local si es válido --- */
  private getFromCache<T>(key: string, ttl: number): T | null {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    try {
      const entry = JSON.parse(stored);
      const now = Date.now();

      // Validación de caducidad
      if (now < entry.expiry) {
        return entry.data;
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error leyendo la caché para ${key}:`, error);
      localStorage.removeItem(key);
    }
    return null;
  }

  /* --- Persiste un dato en localStorage con una marca de tiempo de expiración --- */
  private saveToCache(key: string, data: any, ttl: number): void {
    const entry = {
      data: data,
      expiry: Date.now() + ttl
    };
    try {
      // Intentamos guardar los datos normales
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (quotaError) {
      console.warn('⚠️ Memoria caché llena. Vaciando datos antiguos...', quotaError);
      try {
        // Borramos toda la caché para hacer hueco
        localStorage.clear();
        localStorage.setItem(key, JSON.stringify(entry));
      } catch (retryError) {
        console.error('No se pudo guardar en caché. Archivo demasiado grande.', retryError);
      }
    }
  }

  /*
   * ESTRATEGIA DE REINTENTO
   */
  private getRetryStrategy() {
    return retry({
      count: 5, // Intentar 5 veces antes de rendirse
      delay: (error, retryCount) => {
        // Si es error 429 (Too Many Requests) o 500 (Server Error)
        if (error.status === 429 || error.status >= 500) {
          console.warn(`⚠️ API inestable (${error.status}). Reintentando... (${retryCount}/5)`);
          return timer(5000 * retryCount);
        }
        return throwError(() => error); // Otros errores
      }
    });
  }

  /*
   * MÉTODO AUXILIAR PARA PAGINACIÓN
   */
  private fetchPaginatedResults(urlPrefix: string, cacheKey: string): Observable<Match[]> {
    const pages = [1, 2, 3, 4];

    return from(pages).pipe(
      concatMap(page => {
        const url = `${this.baseUrl}${urlPrefix}/results?page=${page}`;
        return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
          this.getRetryStrategy(),
          delay(500),
          map((res: any) => res?.data || (Array.isArray(res) ? res : [])),
          catchError(() => of([]))
        );
      }),
      toArray(),
      map(resultsArray => resultsArray.flat()),
      tap(data => {
        if (data && data.length > 0) {
          this.saveToCache(cacheKey, data, this.CACHE_TTL.STATIC);
        }
      })
    );
  }

  /*
   * MÉTODOS PÚBLICOS LALIGA (API INTERFACE)
   */

  /* --- Obtiene los partidos que se están jugando en este momento --- */
  getLiveMatches(): Observable<Match[]> {
    const cached = this.getFromCache<Match[]>(this.CACHE_KEYS.LIVE, this.CACHE_TTL.LIVE);
    if (cached) return of(cached);

    return this.http.get<any>(`${this.baseUrl}/api/flashscore/football/live`, { headers: this.getHeaders() }).pipe(
      this.getRetryStrategy(),
      map((res: any) => {
        if (!res) return [];
        return Array.isArray(res) ? res : res.data || [];
      }),
      tap(data => this.saveToCache(this.CACHE_KEYS.LIVE, data, this.CACHE_TTL.LIVE)),
      catchError(err => {
        console.error('Error fetching live matches:', err);
        return of([]);
      })
    );
  }

  /* --- Obtiene los partidos que se están jugando en este momento de LALIGA --- */
  getLaLigaLiveMatches(): Observable<Match[]> {
    const cached = this.getFromCache<Match[]>(this.CACHE_KEYS.LALIGA_LIVE, this.CACHE_TTL.LIVE);
    if (cached) return of(cached);

    const url = `${this.baseUrl}${this.LALIGA_BASE}/live`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      this.getRetryStrategy(),
      map((res: any) => {
        if (!res) return [];
        return Array.isArray(res) ? res : res.data || [];
      }),
      tap(data => this.saveToCache(this.CACHE_KEYS.LALIGA_LIVE, data, this.CACHE_TTL.LIVE)),
      catchError(err => {
        console.error('Error fetching LaLiga live matches:', err);
        return of([]);
      })
    );
  }

  /* --- Obtiene los partidos que se están jugando en este momento del Mundial 2026 --- */
  getWorldCupLiveMatches(): Observable<Match[]> {
    const cached = this.getFromCache<Match[]>(this.CACHE_KEYS.WC_LIVE, this.CACHE_TTL.LIVE);
    if (cached) return of(cached);

    const url = `${this.baseUrl}${this.WORLD_CUP_BASE}/live`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      this.getRetryStrategy(),
      map((res: any) => {
        if (!res) return [];
        return Array.isArray(res) ? res : res.data || [];
      }), 
      tap(data => this.saveToCache(this.CACHE_KEYS.WC_LIVE, data, this.CACHE_TTL.LIVE)),
      catchError(err => {
        console.error('Error fetching World Cup live matches:', err);
        return of([]);
      })
    );
  }

  /* --- Obtiene la tabla de clasificación de La Liga --- */
  getStandings(): Observable<Standing[]> {
    const cached = this.getFromCache<Standing[]>(this.CACHE_KEYS.STANDINGS, this.CACHE_TTL.STATIC);
    if (cached) return of(cached);

    const url = `${this.baseUrl}${this.LALIGA_PREFIX}/standings`;

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      this.getRetryStrategy(),
      map((res: any) => Array.isArray(res) ? res : res.data || []),
      tap(data => {
        if (data.length > 0) this.saveToCache(this.CACHE_KEYS.STANDINGS, data, this.CACHE_TTL.STATIC);
      }),
      catchError(err => {
        console.error('Error fetching standings:', err);
        return of([]);
      })
    );
  }

  /* --- Obtiene el calendario de partidos futuros --- */
  getFixtures(): Observable<Match[]> {
    const cached = this.getFromCache<Match[]>(this.CACHE_KEYS.FIXTURES, this.CACHE_TTL.STATIC);
    if (cached) return of(cached);

    // Endpoint de Flashscore via SportDB
    const url = `${this.baseUrl}${this.LALIGA_PREFIX}/fixtures?page=1`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      this.getRetryStrategy(),
      map((res: any) => {
        // Si la API devuelve null (endpoint vacío/caído), devolvemos array vacío
        if (!res) return [];
        return res.data || (Array.isArray(res) ? res : []);
      }),
      tap(data => {
        // Solo cacheamos si la respuesta contiene datos válidos
        if (data && data.length > 0) {
          this.saveToCache(this.CACHE_KEYS.FIXTURES, data, this.CACHE_TTL.STATIC);
        }
      }),
      catchError(err => {
        console.error('Error fetching fixtures:', err);
        return of([]);
      })
    );
  }

  /* --- Obtiene el calendario pasado en fila india para evitar el Error 429 (Too Many Requests) --- */
  getResults(): Observable<Match[]> {
    const cached = this.getFromCache<Match[]>(this.CACHE_KEYS.RESULTS, this.CACHE_TTL.STATIC);
    if (cached) return of(cached);
    return this.fetchPaginatedResults(this.LALIGA_PREFIX, this.CACHE_KEYS.RESULTS);
  }

  /*
   * MUNDIAL 2026 
   */

  /* --- Obtiene la tabla de clasificación del Mundial --- */
  getWorldCupStandings(): Observable<any[]> {
    const cached = this.getFromCache<any[]>(this.CACHE_KEYS.WC_STANDINGS, this.CACHE_TTL.STATIC);
    if (cached) return of(cached);

    const url = `${this.baseUrl}${this.WORLD_CUP_PREFIX}/standings`;

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      this.getRetryStrategy(),
      map((res: any) => Array.isArray(res) ? res : res.data || []),
      tap(data => {
        if (data.length > 0) this.saveToCache(this.CACHE_KEYS.WC_STANDINGS, data, this.CACHE_TTL.STATIC);
      }),
      catchError(err => {
        console.error('Error fetching World Cup standings:', err);
        return of([]);
      })
    );
  }

  /* --- Obtiene el calendario de partidos futuros --- */
  getWorldCupFixtures(): Observable<Match[]> {
    const cached = this.getFromCache<Match[]>(this.CACHE_KEYS.WC_FIXTURES, this.CACHE_TTL.STATIC);
    if (cached) return of(cached);

    const url = `${this.baseUrl}${this.WORLD_CUP_PREFIX}/fixtures?page=1`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      this.getRetryStrategy(),
      map((res: any) => res?.data || (Array.isArray(res) ? res : [])),
      tap(data => {
        if (data && data.length > 0) {
          this.saveToCache(this.CACHE_KEYS.WC_FIXTURES, data, this.CACHE_TTL.STATIC);
        }
      }),
      catchError(err => {
        console.error('Error fetching World Cup fixtures:', err);
        return of([]);
      })
    );
  }

  /* --- Obtiene el calendario pasado en fila india para evitar el Error 429 (Too Many Requests) --- */
  getWorldCupResults(): Observable<Match[]> {
    const cached = this.getFromCache<Match[]>(this.CACHE_KEYS.WC_RESULTS, this.CACHE_TTL.STATIC);
    if (cached) return of(cached);
    return this.fetchPaginatedResults(this.WORLD_CUP_PREFIX, this.CACHE_KEYS.WC_RESULTS);
  }

  /* --- Buscar equipo por nombre (utilizando la cache) --- */
  searchTeams(teamName: string): Observable<Team[]> {

    // Normalizamos el nombre para las búsquedas
    const translatedName = normalizeTeamName(teamName);

    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `goalstats_search_${translatedName.replace(/\s/g, '_')}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<Team[]>(cacheKey, this.CACHE_TTL.STATIC);
    if (cached) {
      return of(cached);
    }

    // Si no está en caché llamamos a la API 
    return this.http.get<{ teams: Team[] }>(`${this.SPORTSDB_PREFIX}/searchteams.php?t=${translatedName}`)
      .pipe(
        this.getRetryStrategy(),
        map((response: any) => {
          const allTeams = response.teams || [];

          // Solo devolvemos los de fútbol (Soccer)
          return allTeams.filter((team: any) => team.strSport === 'Soccer');
        }),

        // Guardamos el resultado en caché
        tap(data => {
          // Solo guardamos si hemos encontrado algo para no cachear errores
          if (data && data.length > 0) {
            this.saveToCache(cacheKey, data, this.CACHE_TTL.STATIC);
          }
        }),
        catchError(err => {
          console.error('Error en búsqueda:', err);
          return of([]);
        })
      );
  }

  /* --- Buscar JUGADORES por nombre (utilizando la cache) --- */
  searchPlayers(name: string): Observable<any[]> {
    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `goalstats_search_player_${name.replace(/\s/g, '_')}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<any[]>(cacheKey, this.CACHE_TTL.STATIC);
    if (cached) {
      return of(cached);
    }

    // Si no está en caché llamamos a la API 
    return this.http.get<{ player: any[] }>(`${this.SPORTSDB_PREFIX}/searchplayers.php?p=${name}`)
      .pipe(
        this.getRetryStrategy(),
        map((response: any) => {
          const allPlayers = response.player || [];

          return allPlayers.filter((p: any) => p.strSport === 'Soccer');
        }),

        // Guardamos el resultado en caché
        tap(data => {
          // Solo guardamos si hemos encontrado algo para no cachear errores
          if (data && data.length > 0) {
            this.saveToCache(cacheKey, data, this.CACHE_TTL.STATIC);
          }
        }),
        catchError(err => {
          console.error('Error buscando jugadores:', err);
          return of([]);
        })
      );
  }

  /* --- Obtener jugadores del equipo y ordenarlos por posición (utilizando la cache) --- */
  getTeamPlayers(teamId: string): Observable<any[]> {
    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `goalstats_players_${teamId}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<any[]>(cacheKey, this.CACHE_TTL.STATIC);
    if (cached) {
      return of(cached);
    }

    // Si no está en caché llamamos a la API 
    return this.http.get<{ player: any[] }>(`${this.SPORTSDB_PREFIX}/lookup_all_players.php?id=${teamId}`)
      .pipe(
        this.getRetryStrategy(),
        map((response: any) => {
          let players = response.player || [];

          players = players.filter((p: any) => p.strPlayer && p.strPosition && p.strPosition !== 'Manager');

          // Convertir posición específica a número 
          const getPosWeight = (pos: string) => {
            if (!pos) return 5;
            const p = pos.toLowerCase();
            if (p.includes('goalkeeper')) return 1;
            if (p.includes('back') || p.includes('defender')) return 2;
            if (p.includes('midfield')) return 3;
            if (p.includes('wing') || p.includes('forward') || p.includes('striker')) return 4;
            return 5; // Otros
          };

          // Ordenamos el array usando el peso
          return players.sort((a: any, b: any) => getPosWeight(a.strPosition) - getPosWeight(b.strPosition));
        }),

        // Guardamos el resultado en caché
        tap(data => {
          // Solo guardamos si hemos encontrado algo para no cachear errores
          if (data && data.length > 0) {
            this.saveToCache(cacheKey, data, this.CACHE_TTL.STATIC);
          }
        }),
        catchError(err => {
          console.error('Error en búsqueda:', err);
          return of([]);
        })
      );
  }

  /* --- Obtener detalles de un jugador por ID (utilizando la cache) --- */
  getPlayerById(playerId: string): Observable<any> {
    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `goalstats_player_detail_${playerId}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<any>(cacheKey, this.CACHE_TTL.STATIC);
    if (cached) {
      return of(cached);
    }

    // Si no está en caché llamamos a la API 
    return this.http.get<{ players: any[] }>(`${this.SPORTSDB_PREFIX}/lookupplayer.php?id=${playerId}`)
      .pipe(
        this.getRetryStrategy(),
        map((res: any) => {
          const players = res.players || [];
          return players.length > 0 ? players[0] : null;
        }),

        // Guardamos el resultado en caché
        tap(data => {
          // Solo guardamos si hemos encontrado algo para no cachear errores
          if (data) {
            this.saveToCache(cacheKey, data, this.CACHE_TTL.STATIC);
          }
        }),
        catchError(err => {
          console.error('Error fetching player detail:', err);
          return of(null);
        })
      );
  }

  /* --- Información basica de un partido. Busca tanto en partidos en vivo como en el calendario --- */
  getMatchBasicInfo(matchId: string): Observable<any> {
    // Limpiamos el ID 
    const cleanId = matchId.replace('g_1_', '');

    // Buscamos en getFixtures y getLiveMatches
    return forkJoin({
      fixtures: this.getFixtures(),
      live: this.getLiveMatches(),
      wcFixtures: this.getWorldCupFixtures(),
      wcResults: this.getWorldCupResults()
    }).pipe(
      map(results => {
        // Unificamos las listas
        const allMatches = [...(results.fixtures || []), ...(results.live || []), ...(results.wcFixtures || []), ...(results.wcResults || [])];

        // Buscamos el partido por ID (con o sin prefijo)
        return allMatches.find(m => m.eventId === cleanId || m.eventId === `g_1_${cleanId}`);
      }),
      catchError(() => of(null))
    );
  }

  /* --- Obtener detalles de un partido (Alineaciones, Eventos, Stats) --- */
  getMatchDetails(matchId: string): Observable<any> {
    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `${this.CACHE_KEYS.MATCH_DETAIL_PREFIX}${matchId}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<any>(cacheKey, this.CACHE_TTL.LIVE);
    if (cached) {
      return of(cached);
    }

    // Limpieza de ID para la URL
    const cleanId = matchId.replace('g_1_', '');

    // Si no está en caché llamamos a la API 
    const urlLineups = `${this.baseUrl}/api/flashscore/match/${cleanId}/lineups`;
    const urlStats = `${this.baseUrl}/api/flashscore/match/${cleanId}/stats`;
    const urlSummary = `${this.baseUrl}/api/flashscore/match/${cleanId}/details?with_events=true`;

    // Ejecución paralela
    return forkJoin({
      // Usamos catchError individual y retry strategy, si falla uno y no falla el otro que no falle toda la carga
      lineups: this.http.get<any>(urlLineups, { headers: this.getHeaders() }).pipe(this.getRetryStrategy(), catchError(() => of(null))),
      stats: this.http.get<any>(urlStats, { headers: this.getHeaders() }).pipe(this.getRetryStrategy(), catchError(() => of(null))),
      summary: this.http.get<any>(urlSummary, { headers: this.getHeaders() }).pipe(this.getRetryStrategy(), catchError(() => of(null)))
    }).pipe(
      map((results: any) => {
        const lineupsData = results.lineups?.data || results.lineups || null;
        const statsData = results.stats?.data || results.stats || null;
        const summaryData = results.summary?.data?.events || results.summary?.events || results.summary?.data || results.summary || null;

        // Si ambos endpoints fallan o están vacíos, devolvemos null
        if (!lineupsData && !statsData) return null;

        return {
          lineups: lineupsData,
          stats: statsData,
          summary: summaryData
        };
      }),

      // Guardamos el resultado en caché
      tap(data => {
        // Solo guardamos si hemos encontrado algo para no cachear errores
        if (data) {
          this.saveToCache(cacheKey, data, this.CACHE_TTL.LIVE);
        }
      }),
      catchError(err => {
        console.error('Error obteniendo detalles del partido:', err);
        return of(null);
      })
    );
  }

  /* --- Calcula la Racha (Últimos 5 partidos: V-E-D) de un equipo --- */
  private calculateForm(matches: Match[], teamName: string, limit: number): string[] {
    // Filtramos solo los partidos que haya jugado este equipo y que tengan resultado
    const teamMatches = matches.filter(m =>
      (m.homeName === teamName || m.awayName === teamName) &&
      m.homeScore !== undefined && m.awayScore !== undefined
    );

    // Ordenamos por fecha (del más reciente al más antiguo)
    teamMatches.sort((a, b) => {
      const dateA = Number(a.eventStartTime || a.startUtime || a.startTime || 0);
      const dateB = Number(b.eventStartTime || b.startUtime || b.startTime || 0);
      return dateB - dateA;
    });

    // Cogemos solo los últimos 'N' partidos y calculamos si fue Victoria (V), Empate (E) o Derrota (D)
    return teamMatches.slice(0, limit).map(m => {
      const homeScore = Number(m.homeScore);
      const awayScore = Number(m.awayScore);

      // Si el partido terminó en empate
      if (homeScore === awayScore) return 'E';

      // Vemos si jugaba el equipo como local o visitante para determinar si fue victoria o derrota
      const isHome = m.homeName === teamName;
      const homeWins = homeScore > awayScore;
      if (isHome) {
        return homeWins ? 'V' : 'D';
      } else {
        return homeWins ? 'D' : 'V';
      }
    });
  }

  /* --- Obtiene la racha de un equipo y la almacena en caché --- */
  private getFormFromSource(
    source: Observable<Match[]>,
    teamName: string,
    limit: number,
    cacheKey: string
  ): Observable<string[]> {

    return source.pipe(
      map(matches => this.calculateForm(matches, teamName, limit)),
      tap(form => {
        if (form.length > 0) {
          this.saveToCache(cacheKey, form, this.CACHE_TTL.STATIC);
        }
      }),
      catchError(() => of([]))
    );
  }

  /* --- Calcula la Racha (Últimos 5 partidos: V-E-D) de un equipo --- */
  getTeamForm(teamName: string, limit: number = 5): Observable<string[]> {
    // Si no hay nombre, devolvemos array vacío
    if (!teamName) return of([]);

    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `${this.CACHE_KEYS.TEAM_FORM_PREFIX}${teamName.replace(/\s/g, '_')}`;
    const cached = this.getFromCache<string[]>(cacheKey, this.CACHE_TTL.STATIC);

    // Si ya lo tenemos guardado, lo devolvemos directamente
    if (cached) return of(cached);
    return this.getFormFromSource(this.getResults(), teamName, limit, cacheKey);
  }

  /* --- Calcula la Racha (Últimos 5 partidos: V-E-D) de una Selección del Mundial --- */
  getWorldCupTeamForm(teamName: string, limit: number = 5): Observable<string[]> {
    // Si no hay nombre, devolvemos array vacío
    if (!teamName) return of([]);

    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `${this.CACHE_KEYS.TEAM_FORM_PREFIX}WC_${teamName.replace(/\s/g, '_')}`;
    const cached = this.getFromCache<string[]>(cacheKey, this.CACHE_TTL.STATIC);

    // Si ya lo tenemos guardado, lo devolvemos directamente
    if (cached) return of(cached);
    return this.getFormFromSource(this.getWorldCupResults(), teamName, limit, cacheKey);
  }

  /* --- Obtener Palmarés/Trofeos del Jugador --- */
  getPlayerHonours(id: string): Observable<any[]> {
    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `goalstats_honours_${id}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<any[]>(cacheKey, this.CACHE_TTL.STATIC);
    if (cached) {
      return of(cached);
    }

    // Si no está en caché llamamos a la API     
    return this.http.get<any>(`${this.SPORTSDB_PREFIX}/lookuphonours.php?id=${id}`).pipe(
      this.getRetryStrategy(),
      map((res: any) => res.honours || []),

      // Guardamos el resultado en caché
      tap(data => {
        // Solo guardamos si hemos encontrado algo para no cachear errores
        if (Array.isArray(data) && data.length > 0) this.saveToCache(cacheKey, data, this.CACHE_TTL.STATIC);
      }),
      catchError(err => {
        console.error('Error fetching honours:', err);
        return of([]);
      })
    );
  }

  /* --- Obtener Equipos Anteriores / Historial de Traspasos --- */
  getPlayerFormerTeams(playerId: string): Observable<any[]> {
    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `goalstats_former_teams_${playerId}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<any[]>(cacheKey, this.CACHE_TTL.STATIC);

    if (cached) {
      return of(cached);
    }

    // Si no está en caché llamamos a la API     
    return this.http.get<any>(`${this.SPORTSDB_PREFIX}/lookupformerteams.php?id=${playerId}`).pipe(
      this.getRetryStrategy(),
      map((res: any) => res.formerteams || []),

      // Guardamos el resultado en caché
      tap(data => {
        // Solo guardamos si hemos encontrado algo para no cachear errores
        if (Array.isArray(data) && data.length > 0) {
          this.saveToCache(cacheKey, data, this.CACHE_TTL.STATIC);
        }
      }),
      catchError(err => {
        console.error('Error fetching former teams:', err);
        return of([]);
      })
    );
  }
}