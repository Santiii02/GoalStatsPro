/*
 *  VISUALIZACIÓN DEL CALENDARIO DE PARTIDOS.
 */

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SportDbService } from '../../services/sportdb.service';
import { Match } from '../../models/sport.model';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './matches.html',
  styleUrl: './matches.css'
})
export class MatchesComponent implements OnInit {
  // Inyección de dependencias
  private readonly sportService = inject(SportDbService);
  private readonly router = inject(Router);

  // Estado del componente
  allMatches: Match[] = [];
  matches: Match[] = [];
  rounds: string[] = [];
  selectedRound: string = 'upcoming';
  loading: boolean = true;
  error: string | null = null;

  // Rango de días para mostrar próximos partidos
  private readonly DAYS_RANGE = 21;

  ngOnInit(): void {
    this.loadMatches();
  }


  /* --- Solicita el calendario completo y aplica filtros de fecha --- */
  private loadMatches(): void {
    this.loading = true;
    this.error = null;

    // Pedimos tanto los partidos futuros (fixtures) como los resultados recientes (results)
    forkJoin({
      fixtures: this.sportService.getFixtures(),
      results: this.sportService.getResults()
    }).subscribe({
      next: (data) => {
        // Aseguramos que recibimos arrays válidos
        const rawFixtures = Array.isArray(data.fixtures) ? data.fixtures : [];
        const rawResults = Array.isArray(data.results) ? data.results : [];

        // Juntamos todas las jornadas en un solo array
        const rawMatches = [...rawResults, ...rawFixtures];

        // Normalizamos los datos de cada partido 
        this.allMatches = rawMatches.map(match => {
          let matchDate: Date | undefined;
          if (match.eventStartTime) {
            matchDate = new Date(Number(match.eventStartTime) * 1000);
          } else if (match.startDateTimeUtc) {
            matchDate = new Date(match.startDateTimeUtc);
          }
          match.processedDate = matchDate;

          // Normalización de Escudos
          const imgBase = 'https://static.flashscore.com/res/image/data/';
          if (match.homeLogo && !match.homeLogo.startsWith('http')) {
            match.homeLogo = imgBase + match.homeLogo;
          }
          if (match.awayLogo && !match.awayLogo.startsWith('http')) {
            match.awayLogo = imgBase + match.awayLogo;
          }

          return match;
        }).filter(m => m.processedDate); // Descartamos los que no tengan fecha válida

        // Usamos un Set para obtener jornadas únicas
        const uniqueRounds = new Set<string>();
        this.allMatches.forEach(m => {
          if (m.round) uniqueRounds.add(m.round);
        });

        // Ordenamos las jornadas numéricamente
        this.rounds = Array.from(uniqueRounds).sort((a, b) => {
          const numA = Number.parseInt(a.replace(/\D/g, ''), 10) || 0;
          const numB = Number.parseInt(b.replace(/\D/g, ''), 10) || 0;
          return numA - numB;
        });

        // Filtro por defecto ("Próximos partidos")
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo obtener el calendario completo. Inténtelo más tarde.';
        this.loading = false;
      }
    });
  }

  /* --- Evento al cambiar el select en el HTML --- */
  onFilterChange(): void {
    this.applyFilter();
  }

  /* --- Filtra la lista  de todos los partidos según la opción seleccionada --- */
  private applyFilter(): void {
    const now = new Date();

    if (this.selectedRound === 'upcoming') {
      // Próximos partidos
      const limitDate = new Date();
      limitDate.setDate(now.getDate() + this.DAYS_RANGE);

      this.matches = this.allMatches
        .filter(match => match.processedDate! >= now && match.processedDate! <= limitDate)
        .sort((a, b) => a.processedDate!.getTime() - b.processedDate!.getTime());
    } else {
      // Partidos de una jornada específica
      this.matches = this.allMatches
        .filter(match => match.round === this.selectedRound)
        .sort((a, b) => a.processedDate!.getTime() - b.processedDate!.getTime());
    }
  }

  /* --- Formatea el nombre de la jornada --- */
  formatRound(round: string | undefined | null): string {
    if (!round) return '';
    return round.replace(/\bRound\b/gi, 'Jornada');
  }

  /* --- Información detalla del partido  --- */
  goToMatch(match: Match): void {
    if (match?.eventId) {
      this.router.navigate(['/match', match.eventId], {
        state: { data: match }
      });
    }
  }
}
