/*
 *  INFORMACIÓN DEL JUGADOR.
 */

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common'; // Location para volver atrás
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SportDbService } from '../../services/sportdb.service';

@Component({
  selector: 'app-player-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule],
  templateUrl: './player-detail.html',
  styleUrl: './player-detail.css'
})
export class PlayerDetailComponent implements OnInit {

  // Inyección de dependencias
  private route = inject(ActivatedRoute);
  private sportService = inject(SportDbService);
  private location = inject(Location);

  // Estado del componente
  player: any = null;
  loading: boolean = true;
  age: number | null = null;

  ngOnInit(): void {
    const playerId = this.route.snapshot.paramMap.get('id');
    
    if (playerId) {
      this.loadPlayer(playerId);
    }
  }

    /* --- Carga de datos del jugador --- */
  private loadPlayer(id: string): void {
    this.loading = true;
    this.sportService.getPlayerById(id).subscribe({
      next: (data) => {
        this.player = data;
        if (this.player && this.player.dateBorn) {
          this.age = this.calculateAge(this.player.dateBorn);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  /* --- Botón Volver  --- */
  goBack(): void {
    this.location.back();
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
}