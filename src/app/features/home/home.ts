/*
 *  VISUALIZACIÓN DE LOS PARTIDOS EN VIVO Y CLASIFICACIÓN GENERAL.
 *  EL USUARIO PUEDE BUSCAR UN EQUIPO Y VER SU INFORMACIÓN
 */

import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SportDbService } from '../../services/sportdb.service';
import { Match, Standing, Team } from '../../models/sport.model';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { forkJoin, from, Subject, Subscription, of } from 'rxjs';
import { concatMap, toArray, map, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { translateTeamName } from '../../models/team-mapper';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, ButtonModule, FormsModule, InputTextModule, AutoCompleteModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  // Inyección de dependencias
  private sportService = inject(SportDbService);
  public authService = inject(AuthService);
  private userSubscription!: Subscription;
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  // Constantes de negocio
  private readonly LIGA_NAME = 'LaLiga';
  private readonly LIGA_ID = 'UkksTK1s';

  // Estado del componente
  liveMatches: Match[] = [];
  standings: Standing[] = [];
  loading: boolean = true;

  // Variables para el buscador
  selectedItem: any;         
  filteredItems: any[] = [];

  // Busquedas de forma reactiva para evitar saturar la API y mejorar la experiencia del usuario
  private readonly searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  // Mensaje dinámico para informar al usuario sobre el filtro aplicado
  filterMessage: string = '';

  // Variables para equipos favoritos
  favoriteTeamsData: Team[] = [];
  loadingFavorites: boolean = false;

  // Variables para jugadores favoritos
  favoritePlayersData: any[] = [];
  loadingFavPlayers: boolean = false;

  readonly COPA_WINNER = 'Real Sociedad'; 

  ngOnInit(): void {
    this.loadData();
    
    // Si el usuario ya está logueado al entrar, cargamos sus favoritos
    if (this.authService.currentUser) {
      this.loadFavoriteTeams();
      this.loadFavoritePlayers();
    }

    // Escuchamos cambios en la autenticación para recargar favoritos cuando el usuario inicie sesión o cierre sesión
    this.userSubscription = this.authService.user$.subscribe(user => {
      // Evitamos peticiones duplicadas si ya se están cargando o ya hay datos cargados
      if (user) {
        if (this.favoriteTeamsData.length === 0 && !this.loadingFavorites) {
          this.loadFavoriteTeams();
        }
        if (this.favoritePlayersData.length === 0 && !this.loadingFavPlayers) {
          this.loadFavoritePlayers();
        } 
      } else {
        this.favoriteTeamsData = []; // Limpiamos si cierra sesión
        this.favoritePlayersData = []; 
      }
    });

    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300), // Esperamos 300ms después de que el usuario deje de escribir
      distinctUntilChanged(), // Solo busca si el texto es realmente distinto al anterior
      switchMap(query => {
        // Si borran el texto o escriben menos de 2 letras, no buscamos nada
        if (!query || query.trim().length < 2) {
          this.filteredItems = [];
          return of({ teams: [], players: [] });
        }
        
        // Realizamos ambas búsquedas en paralelo y manejamos errores para cada una
        return forkJoin({
          teams: this.sportService.searchTeams(query).pipe(catchError(() => of([]))),
          players: this.sportService.searchPlayers(query).pipe(catchError(() => of([])))
        });
      })
    ).subscribe({
      next: (results) => {
        const teams = (results.teams || []).map(t => ({ ...t, type: 'team' }));
        const players = (results.players || []).map(p => ({ ...p, type: 'player' }));

        // Unimos los arrays y forzamos a que los 'team' vayan siempre antes que los 'player'
        this.filteredItems = [...teams, ...players].sort((a, b) => {
          if (a.type === 'team' && b.type === 'player') return -1;
          if (a.type === 'player' && b.type === 'team') return 1;
          return 0;
        });
      },
      error: (err) => {
        console.error('Error crítico en el buscador:', err);
        this.filteredItems = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
  }

  /* --- Buscador --- */
  search(event: any) {
    const query = event.query;
    if (!query || query.trim() === '') {
      this.filteredItems = [];
      return;
    }
    this.searchSubject.next(query);
  }

  /* --- Seleccionamos una sugerencia del desplegable --- */
  onSelect(event: AutoCompleteSelectEvent) {
    const item = event.value;
    
    if (item.type === 'team') {
      this.router.navigate(['/team', item.strTeam]);
    } else if (item.type === 'player') {
      this.router.navigate(['/player', item.idPlayer]);
    }
    
    // Limpiamos el input
    setTimeout(() => {
      this.selectedItem = null; 
      this.filteredItems = [];  
    }, 10);
  }
  
  /* --- Información detallada del equipo --- */
  goToTeamDetail(team: any): void {
    const teamName = typeof team === 'string' ? team : (team.strTeam || '');
    if (teamName) {
      this.router.navigate(['/team', teamName]);
    }
  }

  /* --- Carga de datos iniciales: Live Scores y Standings --- */
  private loadData(): void {
    this.loading = true;

    // 1. Obtener Partidos en Vivo
    this.sportService.getLiveMatches().subscribe({
      next: (matches: Match[]) => {
        this.processLiveMatches(matches);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching live matches:', err);
        this.filterMessage = 'Servicio de datos en vivo temporalmente no disponible.';
      }
    });

    // 2. Obtener Clasificación
    this.sportService.getStandings().subscribe({
      next: (data: Standing[]) => {
        // Top 5
        this.standings = data;

        // Buscamos las fotos de los equipos 1 por 1 para evitar saturar la API
        if (this.standings.length > 0) {
          from(this.standings).pipe(
            concatMap(row => 
              this.sportService.searchTeams(row.teamName).pipe(
                map(teams => {
                  if (teams && teams.length > 0) {
                    row.teamBadge = teams[0].strTeamBadge || teams[0].strBadge;
                  }
                  return row;
                })
              )
            ),
            toArray()
          ).subscribe({
            next: () => {
              this.loading = false;
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Error fetching standing logos:', err);
              this.loading = false;
              this.cdr.detectChanges();
            }
          });
        } else {
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error fetching standings:', err);
        this.loading = false;
      }
    });
  }

  /* --- Selección de partidos a mostrar --- */
  private processLiveMatches(allMatches: Match[]): void {
    const laLigaMatches = allMatches.filter(m =>
      (m.tournamentName && m.tournamentName.includes(this.LIGA_NAME)) ||
      m.tournamentId === this.LIGA_ID
    );

    if (laLigaMatches.length > 0) {
      // Prioridad 1: Partidos de La Liga.
      this.liveMatches = laLigaMatches;
      this.filterMessage = 'Mostrando partidos de La Liga 🇪🇸';
    } else {
      // Prioridad 2: Top 5 de partidos mundiales
      this.liveMatches = allMatches.slice(0, 5);

      if (this.liveMatches.length > 0) {
        this.filterMessage = 'Sin actividad en La Liga. Mostrando destacados globales 🌍';
      } else {
        this.filterMessage = ''; // No hay ningún partido
      }
    }
  }

  /* --- Carga de equipos favoritos --- */
  private async loadFavoriteTeams() {
    this.loadingFavorites = true;
    this.cdr.detectChanges();

    try {
      const favNames = await this.userService.getFavoriteTeams();
      this.favoriteTeamsData = []; // Reseteamos array
      
      // Hacemos una petición a la API por cada nombre de equipo guardado en Firestore
      for (const name of favNames) {
        this.sportService.searchTeams(name).subscribe({
          next: (teams) => {
            if (teams && teams.length > 0) {
              this.favoriteTeamsData.push(teams[0]);
            this.cdr.detectChanges();
            }
          }
        });
      }
    } catch (error) {
      console.error('Error cargando favoritos en Home', error);
    } finally {
      this.loadingFavorites = false;
      this.cdr.detectChanges();
    }
  }

  /* --- Información detalla del partido  --- */
  goToMatch(match: Match): void {
    if (match && match.eventId) {
      this.router.navigate(['/match', match.eventId], {
        state: { data: match } 
      });
    }
  }

  /* --- Carga de jugadores favoritos --- */
  private async loadFavoritePlayers() {
    this.loadingFavPlayers = true;
    this.cdr.detectChanges();

    try {
      const favIds = await this.userService.getFavoritePlayers();
      this.favoritePlayersData = []; 
      
      // Hacemos una petición a la API por cada ID de jugador guardado
      for (const id of favIds) {
        this.sportService.getPlayerById(id).subscribe({
          next: (player) => {
            if (player) {
              this.favoritePlayersData.push(player);
            this.cdr.detectChanges();
            }
          }
        });
      } 
    } catch (error) {
      console.error('Error cargando jugadores favoritos en Home', error);
    } finally {
      this.loadingFavPlayers = false;
      this.cdr.detectChanges();
    }
  }

  /* --- Información detallada del jugador --- */
  goToPlayerDetail(playerId: string): void {
    this.router.navigate(['/player', playerId]);
  }

  /* --- Posición de Champions (Top 5) --- */
  isTopRank(rank: string | number): boolean {
    return Number(rank) <= 5;
  }

  /* --- Posición de descenso (Puesto > 17) --- */
  isRelegationRank(rank: string | number): boolean {
    return Number(rank) > 17;
  }

  /* --- Busca en qué posición ha quedado el ganador de Copa del Rey --- */
  private getCopaWinnerRank(): number {
    // Si no tenemos datos de los equipos, asumimos que el ganador de Copa no se clasificó para competiciones europeas
    if (!this.standings || this.standings.length === 0) return 999;
    const winner = this.standings.find(t => t.teamName === this.COPA_WINNER);
    return winner ? Number(winner.rank) : 999;
  }

  // Verifica si un equipo participará en la Europa League
  isEuropaLeague(team: Standing): boolean {
    const rank = Number(team.rank);
    const copaRank = this.getCopaWinnerRank();

    // 1. Si está en Champions, la Champions tiene prioridad sobre Europa League
    if (this.isTopRank(rank)) return false;

    // 2. El ganador de Copa siempre va a Europa League si no está en Champions
    if (team.teamName === this.COPA_WINNER) return true;

    // 3. El 6º de LaLiga siempre va a Europa League
    if (rank === 6) return true;

    // 4. Si el ganador de Copa está en el Top 5 o en el puesto 6, el 7º hereda la plaza
    if ((copaRank <= 5 || copaRank === 6) && rank === 7) return true;
    
    // 5. Si está el 7º
    if (copaRank === 7 && rank === 7) return true;

    return false;
  }

  // Verifica si un equipo participará en la Conference League
  isConference(team: Standing): boolean {
    const rank = Number(team.rank);
    const copaRank = this.getCopaWinnerRank();

    // 1. Descartamos a los que están clasificados para Champions o Europa League
    if (this.isTopRank(rank) || this.isEuropaLeague(team)) return false;

    // 2. Si el ganador de Copa quedó entre los 7 primeros, la Conference salta al 8º
    if (copaRank <= 7 && rank === 8) return true;

    // 3. Si el campeón de Copa quedó por debajo del 7º, el 7º va a Conference
    if (copaRank > 7 && rank === 7) return true;

    return false;
  }

  /* --- Traductor de nombres --- */
  translateName(name: string | undefined | null): string {
    if (!name) return '';
    return translateTeamName(name);
  }

  /* --- Etiquetas de Liga --- */
  getLeagueLabel(team: any): string {
    if (!team || !team.strLeague) return 'Desconocido';
    
    const league = team.strLeague.toLowerCase();
    
    // LaLiga
    if (league === 'spanish la liga') {
      return 'LaLiga';
    }
    
    // Selecciones
    if (league.includes('world cup') || league.includes('qualifying') || 
        league.includes('nations league') || league.includes('friendlies') || 
        league.includes('euro ') || league.includes('copa america')) {
      return 'Selección Nacional';
    }
    
    // Resto de ligas (Premier, Serie A, etc.)
    return team.strLeague;
  }
}
