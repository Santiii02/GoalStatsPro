/*
 * Servicio para gestionar la comunicación con Gemini AI.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatchStat } from '../models/sport.model';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);

  // Función para generar el análisis de un partido usando Gemini AI
  async generateMatchAnalysis(
    homeTeam: string, awayTeam: string, stats: MatchStat[], league: string, hasRealStats: boolean
  ): Promise<string> {
    try {
      // Llamamos a la API de nuestro backend "/api/ai/analysis", que a su vez llama a Gemini
      const res = await firstValueFrom(
        this.http.post<{ analysis: string }>('/api/ai/analysis', {
          // Información del partido para que Gemini pueda hacer un análisis
          homeTeam, awayTeam, stats, league, hasRealStats
        })
      );
      // Devolvemos el análisis
      return res?.analysis ?? '';
    } catch (error) {
      console.error('Error en Gemini AI:', error);
      throw new Error('El Míster no está disponible en este momento por saturación del servicio.');
    }
  }
}