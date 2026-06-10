/*
 *  BARRA DE BÚSQUEDA DE EQUIPOS/JUGADORES
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AutoCompleteSelectEvent, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { SportDbService } from '../services/sportdb.service';
import { Subject, Subscription } from 'rxjs';
import { getFlashscoreName } from '../models/team-mapper';
import { buildSearchStream, SearchResultItem  } from '../shared/search-helper';
import { SearchAutocompleteComponent } from '../shared/search-autocomplete';


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchAutocompleteComponent],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent implements OnInit, OnDestroy {

  private readonly sportService = inject(SportDbService);
  private readonly router = inject(Router);

  // Busquedas de forma reactiva para evitar saturar la API y mejorar la experiencia del usuario
  private readonly searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  /* --- Variables --- */
  filteredItems: SearchResultItem[] = []; // Resultados de la búsqueda

  ngOnInit(): void {
    this.searchSubscription = buildSearchStream(this.searchSubject, this.sportService).subscribe({
      next: (items: SearchResultItem[]) => { this.filteredItems = items; },
      error: (err: any) => { console.error('Error crítico en el buscador:', err); this.filteredItems = []; }
    });
  }

  /* --- Lógica de Búsqueda del usuario --- */
  search(event: AutoCompleteCompleteEvent): void {
    const query: string = event.query ?? '';
    if (query.trim().length < 2) this.filteredItems = [];
    this.searchSubject.next(query);
  }


  /* --- Redirigimos la búsqueda según el tipo --- */
  onSelect(event: AutoCompleteSelectEvent): void {
    const item = event.value;

    if (item.type === 'team') {
      // Normalizamos el nombre del equipo
      const flashscoreName = getFlashscoreName(item.strTeam);
      this.router.navigate(['/team', flashscoreName]);
    } else if (item.type === 'player') {
      this.router.navigate(['/player', item.idPlayer]);
    }

    this.filteredItems = [];
  }

  /* --- Limpiamos memoria al destruir el componente --- */
  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }
}