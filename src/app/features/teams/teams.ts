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

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teams.html',
  styleUrl: './teams.css'
})
export class TeamsComponent implements OnInit {
  // Inyección de dependencias
  private sportService = inject(SportDbService);
  private router = inject(Router);

  // Estado del componente
  teams: Standing[] = [];
  loading: boolean = true;
  error: string | null = null;

  readonly COPA_WINNER = 'Real Sociedad';

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
      error: (err: any) => {
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
    return Number(rank) <= 5;
  }

  // Devuelve true si está en descenso (Puesto > 17)
  isRelegationRank(rank: string | number): boolean {
    return Number(rank) > 17;
  }

  /* --- Busca en qué posición ha quedado el ganador de Copa del Rey --- */
  private getCopaWinnerRank(): number {
    // Si no tenemos datos de los equipos, asumimos que el ganador de Copa no se clasificó para competiciones europeas
    if (!this.teams || this.teams.length === 0) return 999;
    const winner = this.teams.find(t => t.teamName === this.COPA_WINNER);
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

    // 3. El 6º de LaLiga SIEMPRE va a Europa League
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
}
