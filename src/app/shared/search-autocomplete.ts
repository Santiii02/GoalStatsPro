/*
 *  BUSCADOR DE EQUIPOS Y JUGADORES
 */
import { Component, Input, Output, EventEmitter, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';

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
    @Input() suggestions: any[] = [];

    /* Texto del placeholder */
    @Input() placeholder: string = 'Buscar equipo o jugador...';

    /* Clase CSS adicional para el p-autoComplete */
    @Input() styleClass: string = '';

    /* Clase CSS adicional para el input interno */
    @Input() inputStyleClass: string = '';

    /* Emite cuando el usuario escribe en el input */
    @Output() completeMethod = new EventEmitter<any>();

    /* Emite cuando el usuario selecciona una sugerencia */
    @Output() itemSelect = new EventEmitter<AutoCompleteSelectEvent>();

    /* Emite cuando el usuario limpia el campo. */
    @Output() cleared = new EventEmitter<void>();

    // Valor seleccionado
    selectedItem: any = null;

    onSearch(event: any): void {
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