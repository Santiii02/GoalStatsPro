import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
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
    LIVE: 5 * 60 * 1000,        // 5 minuto (Datos volátiles)
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
   * MÉTODOS PÚBLICOS (API INTERFACE)
   */

  /* --- Obtiene los partidos que se están jugando en este momento --- */
  getLiveMatches(): Observable<Match[]> {
    const cached = this.getFromCache<Match[]>(this.CACHE_KEYS.LIVE, this.CACHE_TTL.LIVE);
    if (cached) return of(cached);

    return this.http.get<any>(`${this.baseUrl}/api/flashscore/football/live`, { headers: this.getHeaders() }).pipe(
      map(res => {
        // Normalización: La API puede devolver array directo o { data: [...] }
        return Array.isArray(res) ? res : res.data || [];
      }),
      tap(data => this.saveToCache(this.CACHE_KEYS.LIVE, data, this.CACHE_TTL.LIVE)),
      catchError(err => {
        console.error('Error fetching live matches:', err);
        return of([]); // Fallback seguro: array vacío
      })
    );
  }

  /* --- Obtiene la tabla de clasificación de La Liga --- */
  getStandings(): Observable<Standing[]> {
    const cached = this.getFromCache<Standing[]>(this.CACHE_KEYS.STANDINGS, this.CACHE_TTL.STATIC);
    if (cached) return of(cached);

    const url = `${this.baseUrl}/api/flashscore/football/spain:176/laliga:QVmLl54o/${this.CURRENT_SEASON}/standings`;

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      map(res => Array.isArray(res) ? res : res.data || []),
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
      map(res => {
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

  /* --- Buscar equipo por nombre --- */
  searchTeams(name: string): Observable<Team[]> {
    const theSportsDbUrl = 'https://www.thesportsdb.com/api/v1/json/3';

    return this.http.get<{ teams: Team[] }>(`${theSportsDbUrl}/searchteams.php?t=${name}`)
      .pipe(
        map(response => {
          const allTeams = response.teams || [];

          // Solo devolvemos los de fútbol (Soccer)
          const soccerTeams = allTeams.filter(team => team.strSport === 'Soccer');

          return soccerTeams;
        }),
        catchError(err => {
          console.error('Error en búsqueda:', err);
          return of([]);
        })
      );
  }

  /* --- Obtener jugadores del equipo y ordenarlos por posición --- */
  getTeamPlayers(teamId: string): Observable<any[]> {
    const theSportsDbUrl = 'https://www.thesportsdb.com/api/v1/json/3';
    return this.http.get<{ player: any[] }>(`${theSportsDbUrl}/lookup_all_players.php?id=${teamId}`)
      .pipe(
        map(response => {
          let players = response.player || [];

          players = players.filter(p => p.strPlayer && p.strPosition && p.strPosition !== 'Manager');

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
          return players.sort((a, b) => {
            return getPosWeight(a.strPosition) - getPosWeight(b.strPosition);
          });
        })
      );
  }
}
