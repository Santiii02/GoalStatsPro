/*
 *  INFORMACIÓN DEL JUGADOR.
 */

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common'; // Location para volver atrás
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { SportDbService } from '../../services/sportdb.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { translatePositionMapping } from '../../models/team-mapper';

@Component({
  selector: 'app-player-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, TooltipModule],
  templateUrl: './player-detail.html',
  styleUrl: './player-detail.css'
})
export class PlayerDetailComponent implements OnInit {

  // Inyección de dependencias
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sportService = inject(SportDbService);
  public authService = inject(AuthService);
  private userService = inject(UserService);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef);

  // Estado del componente
  player: any = null;
  loading: boolean = true;
  age: number | null = null;
  isFavorite: boolean = false;
  isFavLoading: boolean = false;
  honours: any[] = [];
  formerTeams: any[] = [];
  showFullBio: boolean = false;
  cleanedBioText: string = '';
  isBioEnglishOnly: boolean = false;
  errorFetchingPlayer: boolean = false;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const playerId = params.get('id');
      
      if (playerId) {
        this.loadPlayer(playerId);
      }
    });
  }

  /* --- Carga de datos del jugador --- */
  private loadPlayer(id: string): void {
    this.loading = true;
    this.errorFetchingPlayer = false;

    this.sportService.getPlayerById(id).subscribe({
      next: (data) => {
        if (data && data.idPlayer) {
          this.player = data;
          
          if (this.player.dateBorn) {
            this.age = this.calculateAge(this.player.dateBorn);
          }
            
          // Limpiamos la biografía usando Regex
          const rawBio = this.player.strDescriptionES || this.player.strDescriptionEN || '';
          this.cleanedBioText = this.cleanWikipediaText(rawBio);

          // Determinamos si la historia es solo en inglés para mostrar un aviso al usuario
          const hasSpanish = !!this.player.strDescriptionES && this.player.strDescriptionES.trim().length > 0;
          const hasEnglish = !!this.player.strDescriptionEN && this.player.strDescriptionEN.trim().length > 0;
          this.isBioEnglishOnly = !hasSpanish && hasEnglish;

          this.checkIfFavorite();
          this.loadHonours(id);
          this.loadFormerTeams(id);
          
          this.loading = false;
        } else {
          this.loading = false;
          this.errorFetchingPlayer = true;
        }
      },
      error: (err) => {
        console.error('Error al buscar el jugador:', err);
        this.loading = false;
        this.errorFetchingPlayer = true;
      }
    });
  }

  /* --- Carga de Palmarés y Traspasos --- */
  private loadHonours(id: string): void {
    this.sportService.getPlayerHonours(id).subscribe(data => {
      if (data && Array.isArray(data)) {
        // Ordenar por temporada de más reciente a más antigua
        this.honours = data.sort((a, b) => {
          const yearA = Number.parseInt(a.strSeason) || 0;
          const yearB = Number.parseInt(b.strSeason) || 0;
          return yearB - yearA;
        });
      } else {
        this.honours = [];
      }
      this.cdr.detectChanges();
    });
  }

  /* --- Carga de Equipos Anteriores / Historial de Traspasos --- */
  private loadFormerTeams(id: string): void {
    this.sportService.getPlayerFormerTeams(id).subscribe(data => {
      if (data && Array.isArray(data)) {
        // Ordenar por año de salida o de ingreso de más reciente a más antiguo
        this.formerTeams = data.sort((a, b) => {
          const yearA = Number.parseInt(a.strDeparted || a.strJoined) || 0;
          const yearB = Number.parseInt(b.strDeparted || b.strJoined) || 0;
          return yearB - yearA;
        });
      } else {
        this.formerTeams = [];
      }
      this.cdr.detectChanges();

      // Buscamos los escudos de los equipos anteriores si no vienen en la API
      this.formerTeams.forEach(fTeam => {
        // Si el escudo viene vacío o es null, lo buscamos por nombre
        if (!fTeam.strTeamBadge && fTeam.strFormerTeam) {
          this.sportService.searchTeams(fTeam.strFormerTeam).subscribe(teams => {
            if (teams && teams.length > 0) {
              // Si encontramos el equipo le metemos su escudo
              const hdLogo = teams[0].strTeamBadge || teams[0].strBadge;
              if (hdLogo) {
                fTeam.strTeamBadge = hdLogo;
                this.cdr.detectChanges();
              }
            }
          });
        }
      });
    });
  }

  /* --- Gestión de Favoritos --- */
  private async checkIfFavorite() {
    if (!this.authService.currentUser || !this.player?.idPlayer) return;
    try {
      const favorites = await this.userService.getFavoritePlayers();
      this.isFavorite = favorites.includes(this.player.idPlayer);
      this.cdr.detectChanges();
    } catch (error) {
      console.error("Error al cargar favoritos", error);
    }
  }

  /* --- Añadir/Quitar de Favoritos --- */
  async toggleFavorite() {
    if (!this.authService.currentUser || !this.player?.idPlayer) return;

    // Para evitar múltiples clicks mientras se procesa, bloqueamos el botón
    this.isFavLoading = true;
    this.cdr.detectChanges();

    // Actualizamos el estado de favorito
    try {
      await this.userService.toggleFavoritePlayer(this.player.idPlayer, this.isFavorite);
      this.isFavorite = !this.isFavorite; 
    } catch (error) {
      console.error('Error al guardar jugador favorito', error);
    } finally {
      this.isFavLoading = false;
      this.cdr.detectChanges();
    }
  }

  /* --- Botón Volver  --- */
  goBack(): void {
    this.location.back();
  }

  /* --- Biografía: Mostrar más/menos --- */
  toggleBio(): void {
    this.showFullBio = !this.showFullBio;
  }

  /* --- Calcular edad --- */
  private calculateAge(dateString: string): number {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /* --- Enlaces sociales (añadir https si falta) --- */
  getSocialUrl(url: string): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
  }

  /* --- Limpiador de texto y Traductor --- */
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

  /* --- Traductor de Posiciones (Inglés a Español) --- */
  translatePosition(position: string): string {
    return translatePositionMapping(position);
  }


  /* --- Información detallada del equipo --- */
  goToTeamDetail(teamName: string): void {
    if (teamName) {
      this.router.navigate(['/team', teamName]);
    }
  }
}