/*
 *  INFORMACIÓN DEL EQUIPO.
 */

import { Component, Input, OnInit, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { RouterModule, Router } from '@angular/router'; 
import { ButtonModule } from 'primeng/button';  
import { CardModule } from 'primeng/card';      
import { TooltipModule } from 'primeng/tooltip';
import { SportDbService } from '../../services/sportdb.service';
import { Team } from '../../models/sport.model';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, TooltipModule],
  templateUrl: './team-detail.html',
  styleUrl: './team-detail.css'     
})
export class TeamDetailComponent implements OnInit {

  /* --- Recibimos el nombre de la URL automáticamente  para saber el equipo que busca el usuario --- */
  @Input() name!: string;

  /* --- Inyección del servicio --- */
  private sportService = inject(SportDbService);
  private router = inject(Router);
  public authService = inject(AuthService); 
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  /* --- Variables de datos --- */
  team: Team | null = null;
  players: any[] = [];
  loading: boolean = true;
  teamForm: string[] = [];
  isFavorite: boolean = false;
  isFavLoading: boolean = false;

  ngOnInit(): void {
    if (this.name) {
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

          this.checkIfFavorite();

          // Cargamos los jugadores 
          if (this.team.idTeam) {
            this.loadPlayers(this.team.idTeam);
          } else {
            this.loading = false;
          }
          
          // Cargamos la racha V-E-D del equipo
          if (this.team?.strTeam) {
            this.sportService.getTeamForm(this.team.strTeam).subscribe({
              next: (form) => {
                this.teamForm = form;
              },
              error: (err) => {
                console.warn('No se pudo cargar la racha del equipo', err);
                this.teamForm = [];
              },
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

  /* --- Ver el jugador --- */
  goToPlayer(playerId: string): void {
    this.router.navigate(['/player', playerId]);
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
}
