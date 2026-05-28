/*
 *  ANÁLISIS/PRONÓSTICO DEL PARTIDO MEDIANTE IA.
 */

import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(environment.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }


  /* --- Genera un análisis o pronóstico dependiendo de si hay, o todavía no, datos reales. --- */
  async generateMatchAnalysis(homeTeam: string, awayTeam: string, stats: any[], league: string, hasRealStats: boolean): Promise<string> {
    try {
      let prompt = '';

      // ESCENARIO A: El partido está en vivo o terminado y tiene disponibles estadísticas reales
      if (hasRealStats) {
        const statsText = stats.map(s => `- ${s.statName}: ${homeTeam} (${s.homeValue}) vs ${awayTeam} (${s.awayValue})`).join('\n');
        
        prompt = `
          Eres un analista deportivo con amplia experiencia en el mundo del fútbol de élite, estilo 'Maldini'.
          Analiza el partido: ${homeTeam} (Local) contra ${awayTeam} (Visitante) en la competición: ${league}.
          
          Estadísticas del encuentro:
          ${statsText}

          REGLAS:
          1. NO repitas las estadísticas como una lista. Úsalas solo para dar peso a tus argumentos.
          2. Escribe un análisis táctico, directo y al grano, de máximo 3 párrafos, no superando las 80 palabras. Tiene que ser breve y atractivo para que el usuario no se canse de leerlo. 
          3. Indica quién dominó el juego y qué estilo usó cada uno.
          4. Analiza si el resultado es justo comparando los Goles Esperados (xG) o Tiros.
          5. Usa un tono periodístico, profesional y emocionante, motivador para el fan.
          6. Usa formato Markdown (negrita) para remarcar los conceptos clave. Sin títulos grandes.
        `;
      } 

      // ESCENARIO B: Previa (No ha empezado o todas las estadísticas están a 0)
      else {
        prompt = `
          Eres un analista deportivo con amplia experiencia en el mundo del fútbol de élite, estilo 'Maldini'.
          Haz la previa del siguiente partido, próximo a jugarse, o que acaba de empezar pero no disponemos aún de estadísticas reales: ${homeTeam} (Equipo Local) contra ${awayTeam} (Equipo Visitante) en la competición: ${league}.


          REGLAS:
          1. Escribe un pronóstico de la previa táctico, directo y al grano, de máximo 3 párrafos, no superando las 80 palabras. Tiene que ser breve y atractivo para que el usuario no se canse de leerlo. 
          2. Analiza el nivel general y el peso histórico/actual de estos dos equipos.
          3. Dinos tu opinión: Menciona qué equipo es el favorito para ganar y por qué (ten en cuenta el factor campo).
          4. Da un pronóstico de cómo crees que se desarrollará el partido (ej. "dominio absoluto del local", "partido con mucho flujo de juego por el medio campo", "lluvia de goles"), así como un pronóstico de resultado final (ej. "2-1 para el local").
          5. Usa un tono periodístico, profesional y emocionante, motivador para el fan.
          6. Usa formato Markdown (negrita) para remarcar los conceptos clave. Sin títulos grandes.
        `;
      }

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();

    } catch (error) {
      console.error('Error en Gemini AI:', error);
      throw new Error('El Míster no está disponible en este momento por saturación del servicio.');
    }
  }
}