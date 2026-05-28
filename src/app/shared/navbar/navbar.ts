/*
 *  BARRA DE BÚSQUEDA DE EQUIPOS/JUGADORES
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { SportDbService } from '../../services/sportdb.service';
import { forkJoin, Subject, Subscription, of} from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { getFlashscoreName } from '../../models/team-mapper';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AutoCompleteModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent implements OnInit, OnDestroy{
  
  private readonly sportService = inject(SportDbService);
  private readonly router = inject(Router);

  // Busquedas de forma reactiva para evitar saturar la API y mejorar la experiencia del usuario
  private readonly searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  /* --- Variables --- */
  selectedItem: any;       // Lo que el usuario selecciona
  filteredItems: any[] = []; // Resultados de la búsqueda

  ngOnInit() {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300), // Esperamos 300ms después de que el usuario deje de escribir
      distinctUntilChanged(), // Solo busca si el texto es realmente distinto al anterior
      switchMap(query => {
        // Si borran el texto o escriben menos de 2 letras, no buscamos nada
        if (!query || query.trim().length < 2) {
          return of({ teams: [], players: [] });
        }
        
        // Realizamos ambas búsquedas en paralelo y manejamos errores para cada una
        return forkJoin({
          teams: this.sportService.searchTeams(query).pipe(catchError(() => of([]))),
          players: this.sportService.searchPlayers(query).pipe(catchError(() => of([])))
        });
      })
    ).subscribe({
      next: (results) => {
        const teams = (results.teams || []).map(t => ({ ...t, type: 'team' }));
        const players = (results.players || []).map(p => ({ ...p, type: 'player' }));

        // Unimos los arrays y forzamos a que los 'team' vayan siempre antes que los 'player'
        this.filteredItems = [...teams, ...players].sort((a, b) => {
          if (a.type === 'team' && b.type === 'player') return -1;
          if (a.type === 'player' && b.type === 'team') return 1;
          return 0;
        });
      },
      error: (err) => {
        console.error('Error crítico en el buscador:', err);
        this.filteredItems = [];
      }
    });
  }

  /* --- Lógica de Búsqueda del usuario --- */
  search(event: any) {
    this.searchSubject.next(event.query);
  }

  /* --- Redirigimos la búsqueda según el tipo --- */
  onSelect(event: AutoCompleteSelectEvent) {
    const item = event.value;
    
    if (item.type === 'team') {
      // Normalizamos el nombre del equipo
      const flashscoreName = getFlashscoreName(item.strTeam);
      this.router.navigate(['/team', flashscoreName]);
    } else if (item.type === 'player') {
      this.router.navigate(['/player', item.idPlayer]);
    }
    
    // Limpiamos el input
    setTimeout(() => {
      this.selectedItem = null; 
      this.filteredItems = [];  
    }, 10);
  }

  /* --- Limpiamos memoria al destruir el componente --- */
  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }
}