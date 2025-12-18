/*
 *  VISUALIZACIÓN DEL CALENDARIO DE PARTIDOS.
 */

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SportDbService } from '../../services/sportdb.service';
import { Match } from '../../models/sport.model';

@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './matches.html',
  styleUrl: './matches.css'
})
export class MatchesComponent implements OnInit {
  // Inyección de dependencias
  private sportService = inject(SportDbService);

  // Estado del componente
  matches: Match[] = [];
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

    this.sportService.getFixtures().subscribe({
      next: (data: Match[]) => {
        // Nos aseguramos que recibimos un array
        const allMatches = Array.isArray(data) ? data : [];

        // Procesamiento y filtrado de datos
        this.matches = this.filterUpcomingMatches(allMatches);

        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error fetching fixtures:', err);
        this.error = 'No se pudo obtener el calendario de partidos. Inténtelo más tarde.';
        this.loading = false;
      }
    });
  }


  /* --- Filtra partidos de hoy y futuros --- */
  private filterUpcomingMatches(allMatches: Match[]): Match[] {
    const now = new Date();
    // Resetear horas para comparar solo fechas si fuera necesario, 
    // pero aquí mantenemos precisión por hora para no mostrar partidos ya jugados hoy.

    const limitDate = new Date();
    limitDate.setDate(now.getDate() + this.DAYS_RANGE);

    return allMatches
      .filter(match => {
        let matchDate: Date;

        // Normalización de Fecha
        if (match.eventStartTime) {
          // Caso A: Unix Timestamp (segundos) lo convertimos a milisegundos
          matchDate = new Date(Number(match.eventStartTime) * 1000);
        } else if (match.startDateTimeUtc) {
          // Caso B: ISO String standard
          matchDate = new Date(match.startDateTimeUtc);
        } else {
          return false; // Descartar eventos sin fecha válida
        }

        // Persistir la fecha procesada para uso en la vista
        match.processedDate = matchDate;

        // Partidos entre hoy y la fecha limite (21 dias)
        return matchDate >= now && matchDate <= limitDate;
      })
      .sort((a, b) => {
        // Orden cronológico ascendente
        const dateA = a.processedDate?.getTime() || 0;
        const dateB = b.processedDate?.getTime() || 0;
        return dateA - dateB;
      });
  }
}
