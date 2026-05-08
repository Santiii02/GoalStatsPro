/*
 *  VISUALIZACIÓN DE LOS PARTIDOS EN VIVO Y CLASIFICACIÓN GENERAL.
 *  EL USUARIO PUEDE BUSCAR UN EQUIPO Y VER SU INFORMACIÓN
 */

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SportDbService } from '../../services/sportdb.service';
import { Match, Standing, Team } from '../../models/sport.model';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, ButtonModule, FormsModule, InputTextModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  // Inyección de dependencias
  private sportService = inject(SportDbService);
  public authService = inject(AuthService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  // Constantes de negocio
  private readonly LIGA_NAME = 'LaLiga';
  private readonly LIGA_ID = 'UkksTK1s';

  // Estado del componente
  liveMatches: Match[] = [];
  standings: Standing[] = [];
  loading: boolean = true;

  // Mensaje dinámico para informar al usuario sobre el filtro aplicado
  filterMessage: string = '';

  // Variables para el buscador de equipo
  searchQuery: string = ''; 
  foundTeams: Team[] = [];  
  isSearching: boolean = false; 

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
    this.authService.user$.subscribe(user => {
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
  }

  
  /* --- Busca el equipo que quiera el usuario --- */
  searchTeam(): void {
    if (!this.searchQuery.trim()) return; // No buscar si está vacío

    this.isSearching = true;

    this.sportService.searchTeams(this.searchQuery).subscribe({
      next: (teams) => {
        this.foundTeams = teams;
        this.isSearching = false;
      },
      error: (err) => {
        console.error(err);
        this.isSearching = false;
      }
    });
  }

  /* --- Información del equipo que haya buscado el usuario --- */
  goToTeamDetail(team: Team): void {
    this.router.navigate(['/team', team.strTeam]);
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
        this.standings = data.slice(0, 5);

        // Buscamos las fotos de los equipos
        this.standings.forEach(row => {
          this.sportService.searchTeams(row.teamName).subscribe(teams => {
            if (teams && teams.length > 0) {
              const team = teams[0];
              row.teamBadge = team.strTeamBadge || team.strBadge;
            }
          });
        });

        this.loading = false;
        this.cdr.detectChanges();
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
      this.filterMessage = 'Mostrando partidos de La Liga en vivo 🇪🇸';
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
}
