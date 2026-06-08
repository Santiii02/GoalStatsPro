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
import { AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { forkJoin, from, Subject, Subscription } from 'rxjs';
import { concatMap, toArray, map } from 'rxjs/operators';
import { translateTeamName } from '../../models/team-mapper';
import { buildSearchStream } from '../../shared/search-helper';
import { ClassificationHelper } from '../../shared/classification-helper';
import { SearchAutocompleteComponent } from '../../shared/search-autocomplete';



@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, ButtonModule, FormsModule, InputTextModule, SearchAutocompleteComponent],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  // Inyección de dependencias
  private readonly sportService = inject(SportDbService);
  public authService = inject(AuthService);
  private userSubscription!: Subscription;
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  // Estado del componente
  liveMatches: Match[] = [];
  standings: Standing[] = [];
  loading: boolean = true;

  // Variables para el buscador
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

    this.searchSubscription = buildSearchStream(this.searchSubject, this.sportService).subscribe({
      next: (items: any[]) => { this.filteredItems = items; },
      error: (err: any) => { console.error('Error crítico en el buscador:', err); this.filteredItems = []; }
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
  }

  /* --- Buscador --- */
  search(event: any): void {
    const query: string = event.query ?? '';
    if (query.trim().length < 2) this.filteredItems = [];
    this.searchSubject.next(query);
  }

  /* --- Seleccionamos una sugerencia del desplegable --- */
  onSelect(event: AutoCompleteSelectEvent): void {
    const item = event.value;

    if (item.type === 'team') {
      this.router.navigate(['/team', item.strTeam]);
    } else if (item.type === 'player') {
      this.router.navigate(['/player', item.idPlayer]);
    }

    this.filteredItems = [];
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
    forkJoin({
      laliga: this.sportService.getLaLigaLiveMatches(),
      worldCup: this.sportService.getWorldCupLiveMatches(),
      global: this.sportService.getLiveMatches() 
    }).subscribe({
      next: ({ laliga, worldCup, global }) => {
        this.processLiveMatches(laliga, worldCup, global);
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
                  if (teams?.length > 0) {
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

  private processLiveMatches(laligaMatches: Match[], worldCupMatches: Match[], globalMatches: Match[]): void {
    const MAX = 5;
    const result: Match[] = [];

    // Prioridad 1: LALIGA
    result.push(...laligaMatches.slice(0, MAX));

    // Prioridad 2: Mundial
    if (result.length < MAX) {
      result.push(...worldCupMatches.slice(0, MAX - result.length));
    }

    // Prioridad 3: Amistosos Internacionales
    if (result.length < MAX) {
      const friendlies = globalMatches.filter(m =>
        m.tournamentName?.includes('Friendly International')
      );
      result.push(...friendlies.slice(0, MAX - result.length));
    }

    // Prioridad 4: Cualquier partido
    if (result.length < MAX) {
      const remaining = globalMatches.filter(m =>
        !result.some(r => r.eventId === m.eventId)
      );
      result.push(...remaining.slice(0, MAX - result.length));
    }

    this.liveMatches = result;

    const hasLaLiga = laligaMatches.length > 0;
    const hasWorldCup = worldCupMatches.length > 0;
    const hasFriendly = result.some(m => m.tournamentName?.includes('Friendly International'));
    const hasGlobal = result.length > 0 && !hasLaLiga && !hasWorldCup && !hasFriendly;

    if (hasLaLiga && hasWorldCup) {
      this.filterMessage = 'Mostrando partidos de La Liga 🇪🇸 y del Mundial 🌍';
    } else if (hasLaLiga) {
      this.filterMessage = 'Mostrando partidos de La Liga 🇪🇸';
    } else if (hasWorldCup) {
      this.filterMessage = 'Mostrando partidos del Mundial 🌍';
    } else if (hasFriendly) {
      this.filterMessage = 'Sin actividad en La Liga ni en el Mundial. Mostrando amistosos 🌐';
    } else if (hasGlobal) {
      this.filterMessage = 'Sin actividad destacada. Mostrando partidos en vivo 🌍';
    } else {
      this.filterMessage = '';
    }
  }

  /* --- Carga de equipos favoritos --- */
  private async loadFavoriteTeams(): Promise<void> {
    this.loadingFavorites = true;
    this.cdr.detectChanges();

    try {
      const favNames = await this.userService.getFavoriteTeams();
      this.favoriteTeamsData = []; // Reseteamos array

      // Hacemos una petición a la API por cada nombre de equipo guardado en Firestore
      for (const name of favNames) {
        this.sportService.searchTeams(name).subscribe({
          next: (teams) => {
            if (teams?.length > 0) {
              this.favoriteTeamsData.push(teams[0]);
              this.cdr.detectChanges();
            }
          },
          error: (err) => console.error(`Error cargando equipo favorito "${name}":`, err)
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
    if (match?.eventId) {
      this.router.navigate(['/match', match.eventId], {
        state: { data: match }
      });
    }
  }

  /* --- Carga de jugadores favoritos --- */
  private async loadFavoritePlayers(): Promise<void> {
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
          },
          error: (err) => console.error(`Error cargando jugador favorito id="${id}":`, err)
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
    return ClassificationHelper.isTopRank(rank);
  }

  /* --- Posición de descenso (Puesto > 17) --- */
  isRelegationRank(rank: string | number): boolean {
    return ClassificationHelper.isRelegationRank(rank);
  }

  // Verifica si un equipo participará en la Europa League
  isEuropaLeague(team: Standing): boolean {
    return ClassificationHelper.isEuropaLeague(team, this.standings);
  }

  // Verifica si un equipo participará en la Conference League
  isConference(team: Standing): boolean {
    return ClassificationHelper.isConference(team, this.standings);
  }

  /* --- Traductor de nombres --- */
  translateName(name: string | undefined | null): string {
    if (!name) return '';
    return translateTeamName(name);
  }

  /* --- Etiquetas de Liga --- */
  getLeagueLabel(team: any): string {
    if (!team?.strLeague) return 'Desconocido';

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
