/*
 *  SECCIÓN DE ESTADÍSTICAS DE JUGADORES.
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './players.html',
  styleUrl: './players.css'
})
export class PlayersComponent implements OnInit {

  // Estado del componente
  // Usamos any[] intencionadamente ya que el modelo de 'Player' se definirá en la Fase 4
  players: any[] = [];
  loading: boolean = true;
  error: string | null = null;

  ngOnInit(): void {
    this.loadPlayers();
  }

  /* --- Carga de datos de los jugadores --- */
  private loadPlayers(): void {
    this.loading = true;

    setTimeout(() => {
      this.loading = false;
      this.players = []; 
    }, 500);
  }
}
