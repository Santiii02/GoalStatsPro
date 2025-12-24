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
import { Match, Standing } from '../../models/sport.model';
import { ButtonModule } from 'primeng/button';
import { Team } from '../../models/sport.model';

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

  ngOnInit(): void {
    this.loadData();
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
}
