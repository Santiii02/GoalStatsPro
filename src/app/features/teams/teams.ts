/*
 *  LISTADO DE EQUIPOS CON SUS ESTADÍSTICAS PRINCIPALES.
 */

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SportDbService } from '../../services/sportdb.service';
import { Standing } from '../../models/sport.model';
import { from, of } from 'rxjs';
import { concatMap, catchError, tap } from 'rxjs/operators';
import { ClassificationHelper } from '../../shared/classification-helper';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teams.html',
  styleUrl: './teams.css'
})
export class TeamsComponent implements OnInit {
  // Inyección de dependencias
  private readonly sportService = inject(SportDbService);
  private readonly router = inject(Router);

  // Estado del componente
  teams: Standing[] = [];
  loading: boolean = true;
  error: string | null = null;

  ngOnInit(): void {
    this.loadTeams();
  }

  /* --- Carga de datos de los equipos --- */
  private loadTeams(): void {
    this.loading = true;
    this.error = null;

    this.sportService.getStandings().subscribe({
      next: (data: Standing[]) => {
        this.teams = data;
        this.loading = false;

        // Iniciamos la carga secuencial de imágenes
        this.loadTeamImagesSequentially();
      },
      error: (err: unknown) => {
        console.error('Error fetching standings:', err);
        this.error = 'No se pudo cargar la información de los equipos.';
        this.loading = false;
      }
    });
  }

  /* --- Cargamos la imagen una a una para no saturar la API --- */
  private loadTeamImagesSequentially() {
    from(this.teams).pipe(
      concatMap(team => {
        return this.sportService.searchTeams(team.teamName).pipe(
          tap(foundTeams => {
            if (foundTeams && foundTeams.length > 0) {
              const bestMatch = foundTeams[0];
              team.teamBadge = bestMatch.strTeamBadge || bestMatch.strBadge;
            }
          }),
          // Si falla una foto, que no pare el resto
          catchError(() => of(null))
        );
      })
    ).subscribe();
  }

  // Vamos a la info del equipo
  goToTeamDetail(team: Standing): void {
    this.router.navigate(['/team', team.teamName]);
  }

  // Devuelve true si está en Champions (Top 5)
  isTopRank(rank: string | number): boolean {
    return ClassificationHelper.isTopRank(rank);
  }

  // Devuelve true si está en descenso (Puesto > 17)
  isRelegationRank(rank: string | number): boolean {
    return ClassificationHelper.isRelegationRank(rank);
  }

  // Verifica si un equipo participará en la Europa League
  isEuropaLeague(team: Standing): boolean {
    return ClassificationHelper.isEuropaLeague(team, this.teams);
  }

  // Verifica si un equipo participará en la Conference League
  isConference(team: Standing): boolean {
    return ClassificationHelper.isConference(team, this.teams);
  }
}
