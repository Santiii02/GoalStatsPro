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
import { Team } from '../../models/sport.model';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { getFlashscoreName } from '../../models/team-mapper';

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
  private sportService = inject(SportDbService);
  private router = inject(Router);
  public authService = inject(AuthService); 
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  private location = inject(Location);

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

    this.sportService.searchTeams(this.name).subscribe({
      next: (teams) => {
        if (teams && teams.length > 0) {
          this.team = teams[0];

          // Limpiamos el texto de historia para eliminar la basura de Wikipedia usando regex
          const rawHistory = this.team.strDescriptionES || this.team.strDescriptionEN || '';
          this.cleanedHistoryText = this.cleanWikipediaText(rawHistory);

          this.checkIfFavorite();

          // Cargamos los jugadores 
          if (this.team.idTeam) {
            this.loadPlayers(this.team.idTeam);
          } else {
            this.loading = false;
          }
          
          // Cargamos la racha V-E-D del equipo
          if (this.team?.strTeam) {
            // Pasamos el nombre de TheSportsDB a Flashscore
            const flashscoreName = getFlashscoreName(this.team.strTeam);

            this.sportService.getTeamForm(flashscoreName).subscribe({
              next: (form) => {
                this.teamForm = form;
              },
              error: (err) => {
                console.warn("No se pudo cargar la racha del equipo", err);
                this.teamForm = []; 
              }
            });

            // Cargamos los partidos pasados para la tabla y estadísticas
            this.sportService.getResults().subscribe(matches => {
              this.pastMatches = matches.filter(m => m.homeName === flashscoreName || m.awayName === flashscoreName);
              this.pastMatches.sort((a, b) => (b.eventStartTime || 0) - (a.eventStartTime || 0));
              this.calculateStats(flashscoreName);
              this.onMatchTypeChange(); 
              this.cdr.detectChanges();
            });

            // Cargamos los partidos futuros
            this.sportService.getFixtures().subscribe(matches => {
              this.upcomingMatches = matches.filter(m => m.homeName === flashscoreName || m.awayName === flashscoreName);
              this.upcomingMatches.sort((a, b) => (a.eventStartTime || 0) - (b.eventStartTime || 0));
              this.onMatchTypeChange();
              this.cdr.detectChanges();
            });
          }

        } else {
          this.loading = false; 
        }
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
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
    const roundInfo = match.roundInfo?.round || match.round || match.stage;
    if (!roundInfo) return '';
    
    // Si ya es un número puro
    if (!isNaN(Number(roundInfo))) return `J${roundInfo}`;
    
    // Si trae texto ("Round X" o "Jornada X"), extraemos solo el número
    const num = String(roundInfo).replace(/\D/g, ''); 
    return num ? `J${num}` : roundInfo;
  }

  /* --- Posición del jugador --- */
  getPlayerRole(position: string): string {
    if (!position) return '';
    const pos = position.toLowerCase();

    if (pos.includes('goalkeeper')) return 'gk';
    if (pos.includes('back') || pos.includes('defender')) return 'df';
    if (pos.includes('midfield')) return 'mf'; 
    if (pos.includes('wing') || pos.includes('forward') || pos.includes('striker') || pos.includes('attacker')) return 'fw';

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
}
