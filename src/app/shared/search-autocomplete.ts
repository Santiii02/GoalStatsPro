/*
 *  BUSCADOR DE EQUIPOS Y JUGADORES
 */
import { Component, Input, Output, EventEmitter, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule, AutoCompleteSelectEvent, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { SearchResultItem } from './search-helper';

@Component({
    selector: 'app-search-autocomplete',
    standalone: true,
    imports: [CommonModule, FormsModule, AutoCompleteModule],
    templateUrl: './search-autocomplete.html',
    styleUrl: './search-autocomplete.css',
    encapsulation: ViewEncapsulation.None
})
export class SearchAutocompleteComponent {

    /* Sugerencias de búsqueda recibidas */
    @Input() suggestions: SearchResultItem[] = [];

    /* Texto del placeholder */
    @Input() placeholder: string = 'Buscar equipo o jugador...';

    /* Clase CSS adicional para el p-autoComplete */
    @Input() styleClass: string = '';

    /* Clase CSS adicional para el input interno */
    @Input() inputStyleClass: string = '';

    /* Emite cuando el usuario escribe en el input */
    @Output() completeMethod = new EventEmitter<AutoCompleteCompleteEvent>();

    /* Emite cuando el usuario selecciona una sugerencia */
    @Output() itemSelect = new EventEmitter<AutoCompleteSelectEvent>();

    /* Emite cuando el usuario limpia el campo. */
    @Output() cleared = new EventEmitter<void>();

    // Valor seleccionado
    selectedItem: SearchResultItem | null = null;

    onSearch(event: AutoCompleteCompleteEvent): void {
        this.completeMethod.emit(event);
    }

    onSelect(event: AutoCompleteSelectEvent): void {
        this.itemSelect.emit(event);
        setTimeout(() => { this.selectedItem = null; }, 10);
    }

    onClear(): void {
        this.cleared.emit();
    }
}