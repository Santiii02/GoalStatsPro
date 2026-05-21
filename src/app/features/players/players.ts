/*
 *  CATÁLOGO DE JUGADORES
 */

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SportDbService } from '../../services/sportdb.service';
import { Standing } from '../../models/sport.model';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, DropdownModule, ProgressSpinnerModule],
  templateUrl: './players.html',
  styleUrl: './players.css'
})

export class PlayersComponent implements OnInit {
  // Inyección de dependencias
  private sportService = inject(SportDbService);
  private router = inject(Router);

  // Datos
  teamsList: any[] = [];      
  selectedTeam: any = null;   
  players: any[] = [];        
  
  // Estado del componente
  loading: boolean = false;
  searchQuery: string = '';
  currentFilter: string = 'Destacados (Líder de Liga)'; 
  error: string | null = null;


  ngOnInit(): void {
    this.loadInitialData();
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
      this.searchQuery = ''; 
      this.loadTeamPlayersByName(event.value.name);
    }
  }

  /* --- Búsqueda Manual de Jugador --- */
  searchPlayerGlobal(): void {
    if (!this.searchQuery.trim()) return;

    this.loading = true;
    this.selectedTeam = null; 
    this.currentFilter = `Resultados para "${this.searchQuery}"`;

    this.sportService.searchPlayers(this.searchQuery).subscribe({
      next: (results) => {
        this.players = results;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  /* --- Ver el jugador --- */
  goToPlayer(player: any): void {
    if (player && player.idPlayer) {
      this.router.navigate(['/player', player.idPlayer]);
    }
  }

  /* --- Posición del jugador --- */
  getPlayerRole(position: string): string {
    if (!position) return '';
    const pos = position.toLowerCase();

    if (pos.includes('goalkeeper')) return 'gk';
    if (pos.includes('back') || pos.includes('defender')) return 'df';
    if (pos.includes('midfield')) return 'mf';
    if (pos.includes('wing') || pos.includes('forward') || pos.includes('striker')) return 'fw';

    return '';
  }

  /* --- Traductor de Posiciones (Inglés a Español) --- */
  translatePosition(position: string): string {
    if (!position) return 'Desconocido';
    const pos = position.toLowerCase();

    // Porteros
    if (pos.includes('goalkeeper')) return 'Portero';

    // Defensas
    if (pos.includes('left-back') || pos === 'left back') return 'Lat. Izquierdo';
    if (pos.includes('right-back') || pos === 'right back') return 'Lat. Derecho';
    if (pos.includes('centre-back') || pos.includes('center back')) return 'Def. Central';
    if (pos.includes('defender') || pos.includes('back')) return 'Defensa';

    // Centrocampistas
    if (pos.includes('defensive midfield')) return 'Pivote';
    if (pos.includes('attacking midfield')) return 'Mediapunta';
    if (pos.includes('central midfield')) return 'Centrocampista';
    if (pos.includes('left midfield') || pos.includes('left midfielder')) return 'Int. Izquierdo';
    if (pos.includes('right midfield') || pos.includes('right midfielder')) return 'Int. Derecho';
    if (pos.includes('midfield')) return 'Centrocampista';

    // Delanteros
    if (pos.includes('left wing')) return 'Ext. Izquierdo';
    if (pos.includes('right wing')) return 'Ext. Derecho';
    if (pos.includes('centre-forward') || pos.includes('center forward') || pos.includes('striker')) return 'Delantero Centro';
    if (pos === 'winger') return 'Extremo'; 
    if (pos.includes('forward') || pos.includes('wing') || pos.includes('attacker')) return 'Delantero';

    // Si es una posición desconocida, devolvemos el original
    return position;
  }
}
