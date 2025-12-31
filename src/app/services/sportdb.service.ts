import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { map, catchError, tap, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Match, Standing, Team } from '../models/sport.model';

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
    FIXTURES: `goalstats_fixtures_${this.CURRENT_SEASON}`
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
    localStorage.setItem(key, JSON.stringify(entry));
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

  /* --- Buscar equipo por nombre (utilizando la cache) --- */
  searchTeams(name: string): Observable<Team[]> {
    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `goalstats_search_${name.replace(/\s/g, '_')}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<Team[]>(cacheKey, this.CACHE_TTL.STATIC);
    if (cached) {
      return of(cached);
    }

    // Si no está en caché llamamos a la API (
    const theSportsDbUrl = '/api/thesportsdb/api/v1/json/3';

    return this.http.get<{ teams: Team[] }>(`${theSportsDbUrl}/searchteams.php?t=${name}`)
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

  /* --- Obtener jugadores del equipo y ordenarlos por posición (utilizando la cache) --- */
  getTeamPlayers(teamId: string): Observable<any[]> {
    // Generamos una clave única para guardar esto en memoria
    const cacheKey = `goalstats_players_${teamId}`;

    // Comprobamos si ya lo tenemos guardado
    const cached = this.getFromCache<any[]>(cacheKey, this.CACHE_TTL.STATIC);
    if (cached) {
      return of(cached);
    }

    // Si no está en caché llamamos a la API (
    const theSportsDbUrl = '/api/thesportsdb/api/v1/json/3';    
    
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
}
