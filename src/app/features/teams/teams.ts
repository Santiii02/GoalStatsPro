/*
 *  LISTADO DE EQUIPOS CON SUS ESTADÍSTICAS PRINCIPALES.
 */

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SportDbService } from '../../services/sportdb.service';
import { Standing } from '../../models/sport.model';

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
      },
      error: (err: any) => {
        console.error('Error fetching standings:', err);
        this.error = 'No se pudo cargar la información de los equipos. Verifique su conexión.';
        this.loading = false;
      }
    });
  }
}
