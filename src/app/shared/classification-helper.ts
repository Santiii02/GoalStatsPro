/*
 *  HELPER PARA LA CLASIFICACIÓN DE EQUIPOS
 */

import { Standing } from '../models/sport.model';

export class ClassificationHelper {

    private static readonly COPA_WINNER = 'Real Sociedad';

    /* --- Devuelve true si está en Champions (Top 5) --- */
    static isTopRank(rank: string | number): boolean {
        return Number(rank) <= 5;
    }

    /* --- Devuelve true si está en descenso (Puesto > 17) --- */
    static isRelegationRank(rank: string | number): boolean {
        return Number(rank) > 17;
    }

    /* --- Busca en qué posición ha quedado el ganador de Copa del Rey --- */
    private static getCopaWinnerRank(standings: Standing[]): number {
        if (!standings || standings.length === 0) return 999;
        const winner = standings.find(t => t.teamName === this.COPA_WINNER);
        return winner ? Number(winner.rank) : 999;
    }

    /* --- Verifica si un equipo participará en la Europa League --- */
    static isEuropaLeague(team: Standing, standings: Standing[]): boolean {
        const rank = Number(team.rank);
        const copaRank = this.getCopaWinnerRank(standings);

        // 1. Si está en Champions, la Champions tiene prioridad sobre Europa League
        if (this.isTopRank(rank)) return false;

        // 2. El ganador de Copa siempre va a Europa League si no está en Champions
        if (team.teamName === this.COPA_WINNER) return true;

        // 3. El 6º de LaLiga SIEMPRE va a Europa League
        if (rank === 6) return true;

        // 4. Si el ganador de Copa está en el Top 5 o en el puesto 6, el 7º hereda la plaza
        if ((copaRank <= 5 || copaRank === 6) && rank === 7) return true;

        // 5. Si está el 7º
        if (copaRank === 7 && rank === 7) return true;

        return false;
    }

    /* --- Verifica si un equipo participará en la Conference League --- */
    static isConference(team: Standing, standings: Standing[]): boolean {
        const rank = Number(team.rank);
        const copaRank = this.getCopaWinnerRank(standings);

        // 1. Descartamos a los que están clasificados para Champions o Europa League
        if (this.isTopRank(rank) || this.isEuropaLeague(team, standings)) return false;

        // 2. Si el ganador de Copa quedó entre los 7 primeros, la Conference salta al 8º
        if (copaRank <= 7 && rank === 8) return true;

        // 3. Si el campeón de Copa quedó por debajo del 7º, el 7º va a Conference
        if (copaRank > 7 && rank === 7) return true;

        return false;
    }
}