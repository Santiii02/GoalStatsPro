/*
 *  INFORMACIÓN DEL EQUIPO.
 */

import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { RouterModule, Router } from '@angular/router'; 
import { ButtonModule } from 'primeng/button';  
import { CardModule } from 'primeng/card';      
import { SportDbService } from '../../services/sportdb.service';
import { Team } from '../../models/sport.model';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule],
  templateUrl: './team-detail.html',
  styleUrl: './team-detail.css'     
})
export class TeamDetailComponent implements OnInit {

  /* --- Recibimos el nombre de la URL automáticamente  para saber el equipo que busca el usuario --- */
  @Input() name!: string;

  /* --- Inyección del servicio --- */
  private sportService = inject(SportDbService);
  private router = inject(Router);

  /* --- Variables de datos --- */
  team: Team | null = null;
  players: any[] = [];
  loading: boolean = true;
  teamForm: string[] = [];

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

          // Cargamos los jugadores 
          if (this.team.idTeam) {
            this.loadPlayers(this.team.idTeam);
          } else {
            this.loading = false;
          }
          
          // Cargamos la racha V-E-D del equipo
          if (this.team.strTeam) {
            this.sportService.getTeamForm(this.team.strTeam).subscribe(form => {
              this.teamForm = form;
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
}
