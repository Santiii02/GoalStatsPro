/*
 *  HELPER PARA LA BÚSQUEDA EN EL BUSCADOR REACTIVO
 */

import { Subject, of, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { SportDbService } from '../services/sportdb.service';

export function buildSearchStream(
    searchSubject: Subject<string>,
    sportService: SportDbService
): Observable<any[]> {
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
                    const t = (teams || []).map((x: any) => ({ ...x, type: 'team' }));
                    const p = (players || []).map((x: any) => ({ ...x, type: 'player' }));
                    return [...t, ...p].sort((a, b) =>
                        a.type === 'team' && b.type === 'player' ? -1 :
                            a.type === 'player' && b.type === 'team' ? 1 : 0
                    );
                })
            );
        })
    );
}