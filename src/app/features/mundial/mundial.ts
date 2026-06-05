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
  knockoutRounds: string[] = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinales', 'Final'];
  knockouts: { [key: string]: Match[] } = {
    'Dieciseisavos': [],
    'Octavos': [],
    'Cuartos': [],
    'Semifinales': [],
    'Final': []
  };

    // Partidos por Jornada
  private allWorldCupMatches: Match[] = [];
  worldCupRounds: string[] = [];
  selectedRound: string = '';
  matchesByRound: Match[] = [];

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

        // Partidos por jornada
        this.processMatchesByRound(allMatches);

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
    this.knockouts = { 'Dieciseisavos': [], 'Octavos': [], 'Cuartos': [], 'Semifinales': [], 'Final': [] };

    // Clasificamos cada partido en su ronda correspondiente según el nombre de la ronda
    allMatches.forEach(match => {
      const round = (match.round || '').toLowerCase();
      
      if (round.includes('1/16') || round.includes('round of 32')) {
        this.knockouts['Dieciseisavos'].push(match);
      } else if (round.includes('1/8') || round.includes('round of 16')) {
        this.knockouts['Octavos'].push(match);
      } else if (round.includes('1/4') || round.includes('quarter')) {
        this.knockouts['Cuartos'].push(match);
      } else if (round.includes('semi')) {
        this.knockouts['Semifinales'].push(match);
      } else if (round.includes('final') && !round.includes('quarter') && !round.includes('semi') && !round.includes('1/4')) {
        this.knockouts['Final'].push(match);
      }
    });

    for (const round of this.knockoutRounds) {
      this.knockouts[round].sort((a, b) => this.getMatchDate(a) - this.getMatchDate(b));
    }
  }

  /* --- Partidos por jornada --- */
  private processMatchesByRound(allMatches: Match[]): void {
    this.allWorldCupMatches = allMatches;

    // Extraemos las jornadas únicas y las ordenamos
    const rounds = [...new Set(
      allMatches.map(m => m.round).filter((r): r is string => !!r)
    )].sort((a, b) => this.sortRoundOrder(a) - this.sortRoundOrder(b));

    this.worldCupRounds = rounds;

    // Seleccionamos la primera jornada por defecto
    if (rounds.length > 0) {
      this.selectedRound = rounds[0];
      this.filterMatchesByRound();
    }
  }

  /* --- Filtra los partidos según la jornada seleccionada en el desplegable --- */
  filterMatchesByRound(): void {
    this.matchesByRound = this.allWorldCupMatches
      .filter(m => m.round === this.selectedRound)
      .sort((a, b) => this.getMatchDate(a) - this.getMatchDate(b));
    this.cdr.detectChanges();
  }


  /* --- Cambia a la jornada seleccionada --- */
  onRoundChange(event: Event): void {
    this.selectedRound = (event.target as HTMLSelectElement).value;
    this.filterMatchesByRound();
  }

  /* --- Ordena las jornadas --- */
  private sortRoundOrder(round: string): number {
    const r   = round.toLowerCase().trim();
    const num = round.match(/(\d+)/);
    
    // Jornadas de fase de grupos: "Round 1", "Round 2", "Round 3"... aparecen antes de la fase eliminatoria
    if (/^round\s+\d+$/i.test(r) && num) return parseInt(num[1]);
    // Otros formatos de fase de grupos por si cambia la API
    if (r.includes('group') || r.includes('grupo')) {
      return num ? 10 + parseInt(num[1]) : 15;
    }
    // Fase eliminatoria (valores altos para que vayan después del grupo)
    if (r.includes('1/16') || r.includes('round of 32')) return 100;
    if (r.includes('1/8')  || r.includes('round of 16')) return 101;
    if (r.includes('1/4')  || r.includes('quarter'))     return 102;
    if (r.includes('semi'))                               return 103;
    if (r.includes('final'))                              return 104;

    return 50; // fallback: rondas desconocidas van al centro
  }

  /* --- Próximos partidos --- */
  private processUpcomingMatches(fixtures: Match[]): void {
    // Filtramos solo los partidos que no sean de clasificación y que tengan fecha futura
    const sortedFixtures = [...fixtures].sort((a, b) => this.getMatchDate(a) - this.getMatchDate(b));
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

  /* --- Formatea el nombre de la jornada --- */
  formatRound(round: string | undefined | null): string {
    if (!round) return 'Fase de Grupos';
    const r = round.trim();
    const l = r.toLowerCase();

    if (l.includes('1/16') || l.includes('round of 32'))                 return 'Dieciseisavos';
    if (l.includes('1/8')  || l.includes('round of 16'))                 return 'Octavos de final';
    if (l.includes('quarter'))                                            return 'Cuartos de final';
    if (l.includes('semi'))                                               return 'Semifinales';
    if (l.includes('final') && !l.includes('semi') && !l.includes('quarter')) return 'Final';

    // Jornadas de fase de grupos: "Group Stage - Round 3" → "Jornada 3"
    const matchNumber = r.match(/(\d+)/);
    if (matchNumber) return `Jornada ${matchNumber[1]}`;

    // "Round" por "Jornada"
    return r.replace(/\bRound\b/gi, 'Jornada');
  }
}