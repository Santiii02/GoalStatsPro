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
  private http = inject(HttpClient);

  /* --- Temporada actual --- */
  private readonly CURRENT_SEASON = '2025-2026';

  /* --- URL base --- */
  private baseUrl = environment.apiBaseUrl;

  /* --- Constantes de caché --- */
  private readonly CACHE_KEYS = {
    LIVE: 'goalstats_live',
    STANDINGS: `goalstats_standings_${this.CURRENT_SEASON}`,
    FIXTURES: `goalstats_fixtures_${this.CURRENT_SEASON}`,
    RESULTS: `goalstats_results_${this.CURRENT_SEASON}`,
    MATCH_DETAIL_PREFIX: 'goalstats_match_details_',
    TEAM_FORM_PREFIX: 'goalstats_team_form_'
  };

  /* --- Tiempos de vida para la caché en milisegundos --- */
  private readonly CACHE_TTL = {
    LIVE: 60 * 60 * 1000,        // 5 minuto (Datos volátiles), para pruebas lo vamos a hacer cada hora para no agotar requests
    STATIC: 6 * 60 * 60 * 1000  // 6 horas (Datos estáticos como calendarios)
  };

  /* --- Genera las cabeceras HTTP necesarias, incluyendo la autenticación --- */
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Key': environment.apiKey
    });
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
    } catch (e) {
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
    } catch (e) {
      // Si QuotaExceededError
      console.warn('⚠️ Memoria caché llena. Vaciando datos antiguos...');
      
      try {
        // Borramos toda la caché para hacer hueco
        localStorage.clear();
        // Intentamos guardarlo de nuevo en la memoria limpia
        localStorage.setItem(key, JSON.stringify(entry));
      } catch (e2) {
        console.error('No se pudo guardar en caché. Archivo demasiado grande.', e2);
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
   * MÉTODOS PÚBLICOS (API INTERFACE)
   */

  /* --- Obtiene los partidos que se están jugando en este momento --- */
  getLiveMatches(): Observable<Match[]> {
    const cached = this.getFromCache<Match[]>(this.CACHE_KEYS.LIVE, this.CACHE_TTL.LIVE);
    if (cached) return of(cached);

    return this.http.get<any>(`${this.baseUrl}/api/flashscore/football/live`, { headers: this.getHeaders() }).pipe(
      this.getRetryStrategy(),
      // Normalización: La API puede devolver array directo o { data: [...] }
      map((res: any) => Array.isArray(res) ? res : res.data || []),
      tap(data => this.saveToCache(this.CACHE_KEYS.LIVE, data, this.CACHE_TTL.LIVE)),
      catchError(err => {
        console.error('Error fetching live matches:', err);
        return of([]);
      })
    );
  }

  /* --- Obtiene la tabla de clasificación de La Liga --- */
  getStandings(): Observable<Standing[]> {
    const cached = this.getFromCache<Standing[]>(this.CACHE_KEYS.STANDINGS, this.CACHE_TTL.STATIC);
    if (cached) return of(cached);

    const url = `${this.baseUrl}/api/flashscore/football/spain:176/laliga:QVmLl54o/${this.CURRENT_SEASON}/standings`;

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
    const url = `${this.baseUrl}/api/flashscore/football/spain:176/laliga:QVmLl54o/${this.CURRENT_SEASON}/fixtures?page=1`;
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

    const pages = [1, 2, 3, 4]; // La API no devuelve todos los resultados en una sola página, así que tenemos que paginar. 
    
    // Convertimos el array en un flujo que emite 1, luego 2, luego 3...
    return from(pages).pipe(
      // concatMap espera a que termine la petición de una página antes de lanzar la siguiente
      concatMap(page => {
        const url = `${this.baseUrl}/api/flashscore/football/spain:176/laliga:QVmLl54o/${this.CURRENT_SEASON}/results?page=${page}`;
        
        return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(          
          this.getRetryStrategy(),
          delay(500), // Esperamos medio segundo entre página y página para evitar bloqueos por parte de la API
          map((res: any) => res?.data || (Array.isArray(res) ? res : [])),
          catchError(() => of([]))
        );
      }),
      // Una vez terminan las 4 peticiones, junta los 4 arrays en uno solo
      toArray(),
      map(resultsArray => resultsArray.flat()),
      tap(data => {
        if (data && data.length > 0) {
          this.saveToCache(this.CACHE_KEYS.RESULTS, data, this.CACHE_TTL.STATIC);
        }
      })
    );
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
    const theSportsDbUrl = `/api/thesportsdb/api/v1/json/5032939090`;

    return this.http.get<{ teams: Team[] }>(`${theSportsDbUrl}/searchteams.php?t=${translatedName}`)
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
    const theSportsDbUrl = `/api/thesportsdb/api/v1/json/5032939090`;

    return this.http.get<{ player: any[] }>(`${theSportsDbUrl}/searchplayers.php?p=${name}`)
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
    const theSportsDbUrl = `/api/thesportsdb/api/v1/json/5032939090`;    
    
    return this.http.get<{ player: any[] }>(`${theSportsDbUrl}/lookup_all_players.php?id=${teamId}`)
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
    const theSportsDbUrl = `/api/thesportsdb/api/v1/json/5032939090`;

    return this.http.get<{ players: any[] }>(`${theSportsDbUrl}/lookupplayer.php?id=${playerId}`)
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
      live: this.getLiveMatches()   
    }).pipe(
      map(results => {
        // Unificamos las listas
        const allMatches = [...(results.fixtures || []), ...(results.live || [])];
        
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
    const urlStats   = `${this.baseUrl}/api/flashscore/match/${cleanId}/stats`;
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
        const statsData   = results.stats?.data   || results.stats   || null;
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
  getTeamForm(teamName: string, limit: number = 5): Observable<string[]> {
    if (!teamName) return of([]);

    // Comprobamos si ya lo tenemos guardado
    const cacheKey = `${this.CACHE_KEYS.TEAM_FORM_PREFIX}${teamName.replace(/\s/g, '_')}`;
    const cached = this.getFromCache<string[]>(cacheKey, this.CACHE_TTL.STATIC);
    if (cached) return of(cached);

    // Obtenemos todo el historial de resultados de la temporada
    return this.getResults().pipe(
      map(matches => {
        // Filtramos solo los partidos que haya jugado este equipo y que tengan resultado
        const teamMatches = matches.filter(m => 
          (m.homeName === teamName || m.awayName === teamName) && 
          m.homeScore !== undefined && m.awayScore !== undefined
        );

        // Ordenamos por fecha (del más reciente al más antiguo)
        teamMatches.sort((a, b) => {
          const dateA = a.eventStartTime ? Number(a.eventStartTime) : 0;
          const dateB = b.eventStartTime ? Number(b.eventStartTime) : 0;
          return dateB - dateA;
        });

        // Cogemos solo los últimos 'N' partidos (por defecto 5)
        const lastMatches = teamMatches.slice(0, limit);

        // Calculamos si fue Victoria (V), Empate (E) o Derrota (D)
        const form: string[] = lastMatches.map(m => {
          const homeScore = Number(m.homeScore);
          const awayScore = Number(m.awayScore);
          
          // Si el partido terminó en empate
          if (homeScore === awayScore) return 'E';

          // Vemos si jugaba el equipo como local o visitante para determinar si fue victoria o derrota
          const isHome = m.homeName === teamName;

          if (isHome) {
            return homeScore > awayScore ? 'V' : 'D';
          } else {
            return awayScore > homeScore ? 'V' : 'D';
          }
        });

        return form; 
      }),
      tap(form => {
        // Guardamos la racha en caché
        if (form.length > 0) {
          this.saveToCache(cacheKey, form, this.CACHE_TTL.STATIC);
        }
      }),
      catchError(() => of([]))
    );
  }

  /* --- Obtener Palmarés/Trofeos del Jugador --- */
  getPlayerHonours(id: string): Observable<any[]> {
    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `goalstats_honours_${id}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<any[]>(cacheKey, this.CACHE_TTL.STATIC);
    if (cached){ 
      return of(cached);
    }

    // Si no está en caché llamamos a la API 
    const theSportsDbUrl = `/api/thesportsdb/api/v1/json/5032939090/lookuphonours.php?id=${id}`;
    
    return this.http.get<any>(theSportsDbUrl).pipe(
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
    const theSportsDbUrl = `/api/thesportsdb/api/v1/json/5032939090/lookupformerteams.php?id=${playerId}`;
    
    return this.http.get<any>(theSportsDbUrl).pipe(
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