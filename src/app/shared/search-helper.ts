/*
 *  HELPER PARA LA BÚSQUEDA EN EL BUSCADOR REACTIVO
 */

import { Subject, of, Observable, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';
import { SportDbService } from '../services/sportdb.service';
import { Team, Player } from '../models/sport.model';

export type SearchResultItem =
    (Team & { type: 'team' }) |
    (Player & { type: 'player' });

export function buildSearchStream(
    searchSubject: Subject<string>,
    sportService: SportDbService
): Observable<SearchResultItem[]> {
    const byTeamFirst = (a: SearchResultItem, b: SearchResultItem): number => {
        if (a.type === 'team' && b.type === 'player') return -1;
        if (a.type === 'player' && b.type === 'team') return 1;
        return 0;
    };

    return searchSubject.pipe(
        debounceTime(300), // Esperamos 300ms después de que el usuario deje de escribir
        distinctUntilChanged(), // Solo busca si el texto es realmente distinto al anterior
        switchMap(query => {
            // Si borran el texto o escriben menos de 2 letras, no buscamos nada
            if (!query || query.trim().length < 2) {
                return of([]);
            }
            // Realizamos ambas búsquedas en paralelo y manejamos errores para cada una
            return forkJoin({
                teams: sportService.searchTeams(query).pipe(catchError(() => of([]))),
                players: sportService.searchPlayers(query).pipe(catchError(() => of([])))
            }).pipe(
                map(({ teams, players }) => {
                    const t = (teams || []).map((x: Team) => ({ ...x, type: 'team' as const }));
                    const p = (players || []).map((x: Player) => ({ ...x, type: 'player' as const }));
                    return [...t, ...p].sort(byTeamFirst);
                })
            );
        })
    );
}