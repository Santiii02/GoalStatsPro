/*
 *  CATÁLOGO DE JUGADORES
 */

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SportDbService } from '../../services/sportdb.service';
import { Standing } from '../../models/sport.model';
import { getPlayerRoleMapping, translatePositionMapping, translateTeamName } from '../../models/team-mapper';
import { Subject, Subscription, from, of } from 'rxjs';
import { concatMap, map, catchError, toArray, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, DropdownModule, ProgressSpinnerModule, AutoCompleteModule],
  templateUrl: './players.html',
  styleUrl: './players.css'
})

export class PlayersComponent implements OnInit, OnDestroy {
  // Inyección de dependencias
  private readonly sportService = inject(SportDbService);
  private readonly router = inject(Router);

  // Datos
  teamsList: any[] = [];
  selectedTeam: any = null;
  players: any[] = [];

  // Estado del componente
  loading: boolean = false;
  currentFilter: string = 'Destacados (Líder de Liga)';
  error: string | null = null;

  // Variables para el buscador
  selectedPlayer: any = null;
  filteredPlayers: any[] = [];
  private readonly searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;


  ngOnInit(): void {
    this.loadInitialData();
    this.initPredictiveSearch();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  /* --- Inicializa el buscador reactivo--- */
  private initPredictiveSearch(): void {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300), // Espera 300ms después de que el usuario deje de escribir
      distinctUntilChanged(), // Solo busca si el texto es realmente distinto al anterior
      switchMap(query => {
        // Si borran el texto o escriben menos de 2 letras, no buscamos nada
        if (!query || query.trim().length < 2) {
          return of([]);
        }
        // Buscamos jugadores y si hay error devolvemos vacío
        return this.sportService.searchPlayers(query).pipe(catchError(() => of([])));
      })
    ).subscribe({
      next: (results) => {
        this.filteredPlayers = results || [];
      },
      error: (err) => {
        console.error('Error en búsqueda predictiva:', err);
        this.filteredPlayers = [];
      }
    });
  }

  /* --- Carga inicial: Clasificación y Líder --- */
  private loadInitialData(): void {
    this.loading = true;
    this.error = null;

    this.sportService.getStandings().subscribe({
      next: (standings: Standing[]) => {
        if (standings && standings.length > 0) {

          // Mapeamos datos para el Dropdown
          this.teamsList = standings.map(s => ({
            name: s.teamName,
            badge: s.teamBadge
          }));

          // Seleccionamos al líder de la liga por defecto
          const leader = this.teamsList[0];
          this.selectedTeam = leader;

          // Cargamos sus jugadores
          this.loadTeamPlayersByName(leader.name);

          // Cargamos los escudos de todos los equipos en paralelo
          from(this.teamsList).pipe(
            concatMap(team =>
              this.sportService.searchTeams(team.name).pipe(
                map(results => {
                  if (results?.[0]) {
                    team.badge = results[0].strTeamBadge || results[0].strBadge || team.badge;
                  }
                  return team;
                }),
                // si falla una búsqueda, continuamos con el resto
                catchError(() => of(team))
              )
            ),
            toArray()
          ).subscribe(teamsWithBadges => {
            this.teamsList = teamsWithBadges;
            // Refrescamos el equipo seleccionado para que el header del dropdown actualice su escudo
            const updatedSelected = teamsWithBadges.find(t => t.name === this.selectedTeam?.name);
            if (updatedSelected) this.selectedTeam = updatedSelected;
          });


        } else {
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error loading standings:', err);
        this.error = 'No se pudo cargar la información de los jugadores.';
        this.loading = false;
      }
    });
  }

  /* --- Carga jugadores buscando el ID del equipo por nombre --- */
  loadTeamPlayersByName(teamName: string): void {
    this.loading = true;
    this.currentFilter = `Plantilla: ${teamName}`;
    this.players = [];

    this.sportService.searchTeams(teamName).subscribe({
      next: (foundTeams) => {
        if (foundTeams && foundTeams.length > 0) {
          const teamId = foundTeams[0].idTeam;

          this.loadPlayersByTeamId(teamId);
        } else {
          this.loading = false;
        }
      },
      error: () => this.loading = false
    });
  }

  /* --- Obtener jugadores dado un ID de TheSportsDB --- */
  private loadPlayersByTeamId(teamId: string): void {
    this.sportService.getTeamPlayers(teamId).subscribe({
      next: (squad) => {
        this.players = squad;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  /* --- Cambio en el Dropdown de equipos --- */
  onTeamChange(event: any): void {
    if (event.value) {
      this.selectedPlayer = null;
      this.loadTeamPlayersByName(event.value.name);
    }
  }

  /* --- Filtra la lista de jugadores en tiempo real --- */
  filterPlayersList(event: any): void {
    const query = event.query;
    if (!query || query.trim() === '') {
      this.filteredPlayers = [];
      this.searchSubject.next('');
      return;
    }
    this.searchSubject.next(query);
  }

  /* --- Limpia el input si pierden el foco (con retraso para no pisar el click) --- */
  clearIfNotSelected(): void {
    setTimeout(() => {
      // Si no seleccionaron o si está vacío
      if (!this.selectedPlayer || typeof this.selectedPlayer === 'string') {
        this.selectedPlayer = null;
        this.filteredPlayers = [];
      }
    }, 100);
  }

  /* --- Selección de jugador desde el buscador predictivo --- */
  onPlayerSelect(event: AutoCompleteSelectEvent): void {
    const player = event.value;
    if (player?.idPlayer) {
      this.router.navigate(['/player', player.idPlayer]);
    }

    // Limpiamos el input tras navegar
    setTimeout(() => {
      this.selectedPlayer = null;
      this.filteredPlayers = [];
    }, 10);
  }

  /* --- Búsqueda Manual de Jugador --- */
  searchPlayerGlobal(): void {
    if (!this.selectedPlayer) return;

    const query = typeof this.selectedPlayer === 'string' ? this.selectedPlayer : this.selectedPlayer?.strPlayer;

    if (!query || !query.trim()) return;

    this.loading = true;
    this.selectedTeam = null;
    this.currentFilter = `Resultados para "${query}"`;

    this.filteredPlayers = [];

    this.sportService.searchPlayers(query).subscribe({
      next: (results) => {
        this.players = results || [];
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  /* --- Ver el jugador --- */
  goToPlayer(player: any): void {
    if (player?.idPlayer) {
      this.router.navigate(['/player', player.idPlayer]);
    }
  }

  /* --- Posición del jugador --- */
  getPlayerRole(position: string): string {
    return getPlayerRoleMapping(position);
  }

  /* --- Traductor de Posiciones (Inglés a Español) --- */
  translatePosition(position: string): string {
    return translatePositionMapping(position);
  }

  /* --- Traductor de Nacionalidad (Inglés a Español)--- */
  translateNationality(country: string): string {
    return translateTeamName(country);
  }
}
