/*
 * SECCIÓN MUNDIAL 2026
 * Muestra los grupos, la fase eliminatoria y los próximos partidos de la Copa del Mundo.
 */

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, from } from 'rxjs';
import { concatMap, toArray, map } from 'rxjs/operators';
import { SportDbService } from '../../services/sportdb.service';
import { Match } from '../../models/sport.model';
import { translateTeamName } from '../../models/team-mapper';

// Importaciones de PrimeNG para la vista (Las usaremos en el HTML)
import { TabViewModule } from 'primeng/tabview';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-mundial',
  standalone: true,
  imports: [CommonModule, RouterModule, TabViewModule, ProgressSpinnerModule, ButtonModule],
  templateUrl: './mundial.html',
  styleUrl: './mundial.css'
})
export class MundialComponent implements OnInit {
  // Inyección de dependencias
  private readonly sportService = inject(SportDbService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  // Estados de carga
  loading: boolean = true;
  error: boolean = false;

  // Fase de Grupos
  groups: any[] = [];

  // Fase Eliminatoria 
  knockoutRounds: string[] = ['Octavos', 'Cuartos', 'Semifinales', 'Final']; 
  knockouts: { [key: string]: Match[] } = {
    'Octavos': [],
    'Cuartos': [],
    'Semifinales': [],
    'Final': []
  };

  // Próximos partidos generales
  upcomingMatches: Match[] = [];

  ngOnInit(): void {
    this.loadWorldCupData();
  }

  /* --- Cargamos los datos --- */
  private loadWorldCupData(): void {
    this.loading = true;
    this.error = false;

    forkJoin({
      standings: this.sportService.getWorldCupStandings(),
      fixtures: this.sportService.getWorldCupFixtures(),
      results: this.sportService.getWorldCupResults()
    }).subscribe({
      next: (data) => {
        // Fase de Grupos
        if (data.standings && data.standings.length > 0) {
          this.processGroups(data.standings);
        }

        // Unimos partidos pasados y futuros, y filtramos para eliminar las rondas de clasificación
        const allMatches = [...(data.results || []), ...(data.fixtures || [])].filter(m => {
          const tournament = m.tournamentName || '';
          return !tournament.includes('Qualification');
        });

        // Eliminatoria (Octavos, Cuartos...)
        this.processKnockouts(allMatches);

        // Próximos Partidos
        this.processUpcomingMatches(data.fixtures || []);

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando los datos del Mundial:', err);
        this.error = true;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /* --- Procesamos los grupos --- */
  private processGroups(standingsData: any[]): void {
    // Filtramos solo los bloques que vienen etiquetados como "Group X"
    this.groups = standingsData.filter(group => 
      group.roundType && group.roundType.toLowerCase().includes('group')
    ).map(group => {
      group.roundType = group.roundType.replace('Group', 'Grupo');
      return group;
    });

    // Búsqueda de escudos en TheSportsDB usando nuestra caché local
    from(this.groups).pipe(
      concatMap(group => 
        from(group.teams).pipe(
          concatMap((team: any) => 
            this.sportService.searchTeams(team.teamName).pipe(
              map(dbTeams => {
                if (dbTeams && dbTeams.length > 0) {
                  team.teamBadge = dbTeams[0].strTeamBadge || dbTeams[0].strBadge;
                }
                return team;
              })
            )
          ),
          toArray()
        )
      )
    ).subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  /* --- Fase eliminatoria --- */
  private processKnockouts(allMatches: Match[]): void {
    this.knockouts = { 'Octavos': [], 'Cuartos': [], 'Semifinales': [], 'Final': [] };

    // Clasificamos cada partido en su ronda correspondiente según el nombre de la ronda
    allMatches.forEach(match => {
      const roundName = match.round || '';
      
      if (roundName.includes('1/8')) {
        this.knockouts['Octavos'].push(match);
      } else if (roundName.includes('Quarter')) {
        this.knockouts['Cuartos'].push(match);
      } else if (roundName.includes('Semi')) {
        this.knockouts['Semifinales'].push(match);
      } else if (roundName.includes('Final') && !roundName.includes('Quarter') && !roundName.includes('Semi')) {
        this.knockouts['Final'].push(match);
      }
    });

    for (const round of this.knockoutRounds) {
      this.knockouts[round].sort((a, b) => Number(a.eventStartTime || 0) - Number(b.eventStartTime || 0));
    }
  }

  /* --- Próximos partidos --- */
  private processUpcomingMatches(fixtures: Match[]): void {
    // Filtramos solo los partidos que no sean de clasificación y que tengan fecha futura
    const sortedFixtures = [...fixtures].sort((a, b) => Number(a.eventStartTime || 0) - Number(b.eventStartTime || 0));
    this.upcomingMatches = sortedFixtures.slice(0, 6);
  }

  /* --- Información detallada del equipo --- */
  goToTeamDetail(teamName: string): void {
    if (teamName) {
      this.router.navigate(['/team', teamName]);
    }
  }

  /* --- Información detallada del partido --- */
  goToMatch(match: Match): void {
    if (match && match.eventId) {
      this.router.navigate(['/match', match.eventId], {
        state: { data: match } 
      });
    }
  }

  /* --- Obtenemos la fecha del partido --- */
  getMatchDate(match: any): number {
    // Las ligas usan eventStartTime, pero los torneos internacionales usan startUtime o startTime
    const timestamp = match.startUtime || match.startTime || match.eventStartTime || 0;
    return Number(timestamp) * 1000;
  }

  /* --- Obtenemos la URL del logo del equipo --- */
  getLogoUrl(logo: string | undefined | null): string {
    if (!logo) return 'assets/images/Logo.png';
    if (logo.startsWith('http')) return logo;
    return `https://static.flashscore.com/res/image/data/${logo}`;
  }

  /* --- Determina si el equipo es ganador para mostrar el marcador en verde --- */
  isWinner(match: Match, team: 'home' | 'away'): boolean {
    if (match.homeScore === undefined || match.homeScore === null || match.awayScore === undefined || match.awayScore === null) {
      return false;
    }
    const home = Number(match.homeScore);
    const away = Number(match.awayScore);
    return team === 'home' ? home > away : away > home;
  }

  /* --- Traducimos el nombre del equipo --- */
  translateTeam(name: string | undefined | null): string {
    if (!name) return '';
    return translateTeamName(name);
  }
}