/*
 *  BARRA DE BÚSQUEDA DE EQUIPOS/JUGADORES
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { SportDbService } from '../../services/sportdb.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AutoCompleteModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  
  private sportService = inject(SportDbService);
  private router = inject(Router);

  /* --- Variables --- */
  selectedItem: any;       // Lo que el usuario selecciona
  filteredItems: any[] = []; // Resultados de la búsqueda

  /* --- Lógica de Búsqueda del usuario --- */
  search(event: any) {
    const query = event.query;
    
    // Lanzamos las dos peticiones a la vez
    forkJoin({
      teams: this.sportService.searchTeams(query),
      players: this.sportService.searchPlayers(query)
    }).subscribe({
      next: (results) => {
        // Etiquetamos los resultados para saber de qué tipo son
        const teams = (results.teams || []).map(t => ({ ...t, type: 'team' }));
        const players = (results.players || []).map(p => ({ ...p, type: 'player' }));

        // Unimos los resultados: Primero equipos, luego jugadores
        this.filteredItems = [...teams, ...players];
      },
      error: () => {
        this.filteredItems = [];
      }
    });
  }

  /* --- Redirigimos la búsqueda según el tipo --- */
  onSelect(event: AutoCompleteSelectEvent) {
    const item = event.value;
    
    if (item.type === 'team') {
      this.router.navigate(['/team', item.strTeam]);
    } else if (item.type === 'player') {
      this.router.navigate(['/player', item.idPlayer]);
    }
    
    this.selectedItem = null; // Limpiamos el input
  }
}