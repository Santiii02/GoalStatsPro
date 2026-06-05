/*
 *  INFORMACIÓN DEL EQUIPO.
 */

import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule, Location } from '@angular/common'; 
import { RouterModule, Router } from '@angular/router'; 
import { ButtonModule } from 'primeng/button';  
import { CardModule } from 'primeng/card';      
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { SportDbService } from '../../services/sportdb.service';
import { Match, Team } from '../../models/sport.model';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { getFlashscoreName, translateTeamName, getPlayerRoleMapping, translatePositionMapping } from '../../models/team-mapper';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, TooltipModule, FormsModule, DropdownModule],
  templateUrl: './team-detail.html',
  styleUrl: './team-detail.css'     
})
export class TeamDetailComponent implements OnInit, OnChanges {

  /* --- Recibimos el nombre de la URL automáticamente  para saber el equipo que busca el usuario --- */
  @Input() name!: string;

  /* --- Inyección del servicio --- */
  private readonly sportService = inject(SportDbService);
  private readonly router = inject(Router);
  public readonly authService = inject(AuthService); 
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly location = inject(Location);

  /* --- Variables de datos --- */
  team: Team | null = null;
  players: any[] = [];
  loading: boolean = true;
  teamForm: string[] = [];
  isFavorite: boolean = false;
  isFavLoading: boolean = false;
  pastMatches: any[] = [];
  upcomingMatches: any[] = [];
  displayedMatches: any[] = [];
  showFullHistory: boolean = false;
  cleanedHistoryText: string = '';
  isWorldCupTeam: boolean = false;
  errorFetchingTeam: boolean = false;
  isHistoryEnglishOnly: boolean = false;

  // Saber que el equipo pertenece a La Liga
  get isLaLigaTeam(): boolean {
    return this.team?.strLeague === 'Spanish La Liga';
  }

 /* --- Opciones para el desplegable de partidos --- */
  matchFilterOptions = [
    { label: 'Últimos Resultados', value: 'past' },
    { label: 'Próximos Partidos ', value: 'future' }
  ];
  selectedMatchType: string = 'past';
  
  /* --- Estadísticas totales de la temporada (V-E-D) --- */
  matchStats = { played: 0, wins: 0, draws: 0, losses: 0 };

  ngOnInit(): void {
    if (this.name) {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['name'] && !changes['name'].isFirstChange()) {
      this.loadData();
    }
  }

  /*
   * CARGAMOS LA INFORMACIÓN DEL EQUIPO BUSCADO
   */
  private loadData(): void {
    this.loading = true;
    this.errorFetchingTeam = false;
    this.isWorldCupTeam = false;

    this.sportService.searchTeams(this.name).subscribe({
      next: (teams) => {
        if (teams?.length > 0) {
          this.processTeamData(teams[0]);
        } else {
          this.loading = false;
          this.errorFetchingTeam = true;
        }
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  private processTeamData(fetchedTeam: Team): void {
    this.team = fetchedTeam;
    const rawHistory = this.team.strDescriptionES || this.team.strDescriptionEN || '';
    this.cleanedHistoryText = this.cleanWikipediaText(rawHistory);

    const hasSpanish = (this.team.strDescriptionES?.trim().length ?? 0) > 0;
    const hasEnglish = (this.team.strDescriptionEN?.trim().length ?? 0) > 0;
    this.isHistoryEnglishOnly = !hasSpanish && hasEnglish;

    this.checkIfFavorite();

    if (this.team.idTeam) {
      this.loadPlayers(this.team.idTeam);
    } else {
      this.loading = false;
    }

    if (this.team?.strTeam) {
      const flashscoreName = getFlashscoreName(this.team.strTeam);
      if (this.isLaLigaTeam) {
        this.loadLaLigaMatches(flashscoreName);
      } else {
        this.loadWorldCupMatches(flashscoreName);
      }
    }
  }

  private loadLaLigaMatches(flashscoreName: string): void {
    this.sportService.getTeamForm(flashscoreName).subscribe(form => this.teamForm = form);

    this.sportService.getResults().subscribe(matches => {
      const filtered = matches.filter(m => m.homeName === flashscoreName || m.awayName === flashscoreName);
      this.pastMatches = this.filterUniqueMatches(filtered);
      this.pastMatches.sort((a, b) => (b.eventStartTime || 0) - (a.eventStartTime || 0));
      this.calculateStats(flashscoreName);
      this.onMatchTypeChange(); 
      this.cdr.detectChanges();
    });

    this.sportService.getFixtures().subscribe(matches => {
      const filtered = matches.filter(m => m.homeName === flashscoreName || m.awayName === flashscoreName);
      this.upcomingMatches = this.filterUniqueMatches(filtered);
      this.upcomingMatches.sort((a, b) => (a.eventStartTime || 0) - (b.eventStartTime || 0));
      this.onMatchTypeChange();
      this.cdr.detectChanges();
    });
  }

  private loadWorldCupMatches(flashscoreName: string): void {
    this.sportService.getWorldCupTeamForm(flashscoreName).subscribe(form => this.teamForm = form);

    this.sportService.getWorldCupResults().subscribe(matches => {
      const filtered = matches.filter(m => m.homeName === flashscoreName || m.awayName === flashscoreName);
      if (filtered.length === 0) console.warn(`⚠️ Equipo no encontrado en historial Mundial: ${flashscoreName}`);

      this.pastMatches = this.filterUniqueMatches(filtered);
      if (this.pastMatches.length > 0) this.isWorldCupTeam = true; 
      
      this.pastMatches.sort((a, b) => this.getMatchDate(b) - this.getMatchDate(a));
      this.calculateStats(flashscoreName);
      this.onMatchTypeChange(); 
      this.cdr.detectChanges();
    });

    this.sportService.getWorldCupFixtures().subscribe(matches => {
      const filtered = matches.filter(m => m.homeName === flashscoreName || m.awayName === flashscoreName);
      this.upcomingMatches = this.filterUniqueMatches(filtered);
      if (this.upcomingMatches.length > 0) this.isWorldCupTeam = true; 
      
      this.upcomingMatches.sort((a, b) => this.getMatchDate(a) - this.getMatchDate(b));
      this.onMatchTypeChange();
      this.cdr.detectChanges();
    });
  }

  /*
   * FILTRAMOS LOS PARTIDOS PARA ELIMINAR DUPLICADOS
   */
  private filterUniqueMatches(matches: Match[]): Match[] {
    return Array.from(new Map(matches.map(m => [m.eventId, m])).values());
  }

  /*
   * CARGAMOS LOS JUGADORES DEL EQUIPO BUSCADO
   */
  private loadPlayers(id: string): void {
    this.sportService.getTeamPlayers(id).subscribe({
      next: (data) => {
        this.players = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  /*
   * COMPROBAMOS SI EL EQUIPO ES FAVORITO DEL USUARIO
   */
  private async checkIfFavorite() {
    if (!this.authService.currentUser || !this.team?.strTeam) return;
    
    try {
      const favorites = await this.userService.getFavoriteTeams();
      this.isFavorite = favorites.includes(this.team.strTeam);
      this.cdr.detectChanges();
    } catch (error) {
      console.error("Error al cargar favoritos", error);
    }
  }

  /*
   * CAMBIAMOS EL ESTADO DE FAVORITO DEL EQUIPO Y LO GUARDAMOS EN FIRESTORE
   */
  async toggleFavorite() {
    if (!this.authService.currentUser || !this.team?.strTeam) return;

    this.isFavLoading = true;
    this.cdr.detectChanges();
    try {
      // Llamamos a Firestore
      await this.userService.toggleFavorite(this.team.strTeam, this.isFavorite);
      // Actualizamos el estado local del favorito
      this.isFavorite = !this.isFavorite; 
    } catch (error) {
      console.error('Error al guardar favorito', error);
    } finally {
      this.isFavLoading = false;
      this.cdr.detectChanges();
    }
  }

  /*
   * CÁLCULO DE ESTADÍSTICAS TOTALES DE LA TEMPORADA (V-E-D)
   */
  private calculateStats(teamName: string): void {
    let w = 0, d = 0, l = 0;
    
    this.pastMatches.forEach(m => {
      const homeScore = Number(m.homeScore);
      const awayScore = Number(m.awayScore);

      if (homeScore === awayScore) {
        d++;
      } else {
        const isHome = m.homeName === teamName;
        if (isHome) { homeScore > awayScore ? w++ : l++; } 
        else { awayScore > homeScore ? w++ : l++; }
      }
    });

    this.matchStats = { played: this.pastMatches.length, wins: w, draws: d, losses: l };
  }

  /*
   * LIMPIADOR DE TEXTO DE WIKIPEDIA USANDO REGEX
   */
  private cleanWikipediaText(text: string): string {
    if (!text) return '';

    return text
      // Elimina la "n" seguida de un espacio y un número (ej: "BBVA,n 3" -> "BBVA,")
      .replace(/n \d+/g, '')
      // Elimina números pegados justo después de un punto o coma (ej: "United.17" -> "United.")
      .replace(/(?<=[.,])\d+/g, '')
      // Elimina números pegados justo después de una letra (ej: "culés6" -> "culés")
      .replace(/(?<=[a-zA-ZáéíóúÁÉÍÓÚñÑ])\d+/g, '')
      // Limpia los espacios dobles que hayan podido quedar al borrar números
      .replace(/\s{2,}/g, ' ')
      // Elimina comas perdidas sin sentido (ej: "socios, " -> "socios ")
      .replace(/,\s*(?=[.,\s])/g, '')
      .trim();
  }

  /* --- Extraer la jornada del partido para mostrar --- */
  getRoundLabel(match: any): string {

    // Obtenemos el nombre del torneo para descartar partidos de clasificación
    const tournamentName = match.tournamentName || match.tournament?.name || '';

    // Partido de clasificación
    if (tournamentName.toLowerCase().includes('qualification')) {
      return 'Clasificación';
    }
    
    // Numeramos las jornadas
    const roundInfo = match.roundInfo?.round || match.round || match.stage;
    if (!roundInfo) return '';
    
    // Si ya es un número puro
    if (!Number.isNaN(Number(roundInfo))) return `J${roundInfo}`;
    
    // Si trae texto ("Round X" o "Jornada X"), extraemos solo el número
    const num = String(roundInfo).replace(/\D/g, ''); 
    return num ? `J${num}` : roundInfo;
  }

   /* --- Posición del jugador --- */
  getPlayerRole(position: string): string {
    return getPlayerRoleMapping(position);
  }

  /* --- Traductor de Posiciones (Inglés a Español) --- */
  translatePosition(position: string): string {
    return translatePositionMapping(position);
  }

  /* --- Ver el jugador --- */
  goToPlayer(playerId: string): void {
    this.router.navigate(['/player', playerId]);
  }

  /* --- Ver el partido --- */
  goToMatch(match: any): void {
      if (match && match.eventId) {
          this.router.navigate(['/match', match.eventId], {
            state: { data: match } 
          });
      }
  }
  
  /* --- Mapeo de colores para las insignias V-E-D --- */
  getFormColorClass(result: string): string {
    if (result === 'V') return 'form-win';
    if (result === 'E') return 'form-draw';
    if (result === 'D') return 'form-loss';
    return '';
  }

  /* --- Formateamos la URL de las redes sociales para asegurarnos de que tenga el formato correcto --- */
  formatUrl(url: string): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
  }

  /* --- Selecciona el mejor fondo disponible para el Hero --- */
  getHeroBackground(): string {
    if (!this.team) return 'none';
    
    // Prioridad: 1. Banner, 2. Foto del estadio, 3. Fanart1
    const bgImage = this.team['strBanner'] || 
                    this.team['strTeamBanner'] ||
                    this.team['strStadiumThumb'] ||
                    this.team['strFanart1'];
                    
    return bgImage ? `url(${bgImage})` : 'none';
  }

  /* --- Evento del Desplegable --- */
  onMatchTypeChange(): void {
    this.displayedMatches = this.selectedMatchType === 'past' ? this.pastMatches : this.upcomingMatches;
    this.cdr.detectChanges();
  }

  /* --- Función para mostrar/ocultar el texto completo --- */
  toggleHistory(): void {
    this.showFullHistory = !this.showFullHistory;
  }

  /* --- Botón Volver  --- */
  goBack(): void {
    this.location.back();
  }

  /* --- Obtener la fecha del partido --- */
  getMatchDate(match: any): number {
    const timestamp = match.startUtime || match.startTime || match.eventStartTime || 0;
    return Number(timestamp) * 1000;
  }

  /* --- Traductor de nombres --- */
  translateName(name: string | undefined | null): string {
    if (!name) return '';
    // Solo traduce si es un equipo internacional
    return this.isWorldCupTeam ? translateTeamName(name) : name;
  }

  /* --- Etiquetas de Liga --- */
  getLeagueLabel(team: any): string {
    if (!team) return 'Desconocido';
    
    // Si nuestros endpoints ya han detectado partidos oficiales
    if (this.isWorldCupTeam) return 'Selección Nacional';
    if (this.isLaLigaTeam) return 'LaLiga';
    
    // Intentamos detectar por el nombre de la liga
    if (!team.strLeague) return 'Desconocido';
    const league = team.strLeague.toLowerCase();
    
    if (league === 'spanish la liga') return 'LaLiga';
    if (league.includes('world cup') || league.includes('qualifying') || 
        league.includes('nations league') || league.includes('friendlies') || 
        league.includes('euro ') || league.includes('copa america')) {
      return 'Selección Nacional';
    }
    
    // Resto de ligas
    return team.strLeague;
  }

  /* --- Traductor de Nacionalidad (Inglés a Español)--- */
  translateNationality(country: string): string {
    return translateTeamName(country);
  }
}
