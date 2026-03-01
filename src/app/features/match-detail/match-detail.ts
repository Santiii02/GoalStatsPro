/*
 *  INFORMACIÓN DETALLADA DEL PARTIDO.
 */

import { Component, Input, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview'; 
import { TagModule } from 'primeng/tag';
import { SportDbService } from '../../services/sportdb.service';
import { AiService } from '../../services/ai.service';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-match-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, TabViewModule, TagModule, ProgressSpinnerModule],
  templateUrl: './match-detail.html',
  styleUrl: './match-detail.css'
})
export class MatchDetailComponent implements OnInit {

  // ID del partido recibido por URL
  @Input() id!: string;

  // Inyección de dependencias
  private sportService = inject(SportDbService);
  private location = inject(Location);
  private router = inject(Router);
  private aiService = inject(AiService);
  private cdr = inject(ChangeDetectorRef);

  // Estado del componente
  match: any = null;
  loading: boolean = true;
  activeTab: number = 0; // 0: Alineaciones, 1: Estadisticas

  startingLineups: any = null;
  substitutes: any = null;
  matchStats: any[] = [];

  // Variables para la IA
  aiAnalysis: string | null = null;
  aiLoading: boolean = false;
  aiError: boolean = false;

  ngOnInit(): void {
    // Intentar recuperar datos (equipos, marcador)
    const stateData = history.state?.data;

    if (stateData) {
      this.initMatchData(stateData);
    } else {
      // El usuario recarga F5 y los datos en memoria se pierden, buscamos en las listas cacheadas
      this.loading = true;
      
      this.sportService.getMatchBasicInfo(this.id).subscribe({
        next: (rescuedMatch) => {
          if (rescuedMatch) {
            this.initMatchData(rescuedMatch);
          } else {
            this.loading = false; 
          }
        },
        error: () => this.loading = false
      });
    }
  }

  /* --- Iniciar la vista con los datos disponibles --- */
  private initMatchData(data: any): void {
    this.match = this.normalizeBasicData(data);
    // Una vez tenemos lo básico, pedimos los detalles extra
    this.loading = false;
    this.loadMatchDetails();
    this.upgradeImages();  
  }

  /* --- Normaliza los datos --- */
  private normalizeBasicData(basic: any): any {
    return {
      homeTeam: basic.homeName || basic.homeTeam,
      awayTeam: basic.awayName || basic.awayTeam,
      homeLogo: basic.homeLogo,
      awayLogo: basic.awayLogo,
      homeScore: basic.homeScore, 
      awayScore: basic.awayScore,
      status: basic.status || 'Programado',
      league: basic.league || 'La Liga',
      round: basic.round,
      eventId: basic.eventId || this.id,
      ...basic
    };
  }

  /* --- Cargar Alineaciones y Estadisticas --- */
  private loadMatchDetails(): void {
    this.sportService.getMatchDetails(this.id).subscribe({
      next: (data) => {
        if (data) {
          // Fusionamos nuevos datos con los existentes
          this.match = this.match ? { ...this.match, ...data } : data;
          
          // Procesar alineaciones
          if (data.lineups && Array.isArray(data.lineups)) {
            this.startingLineups = data.lineups.find((g: any) => g.group === 'Starting Lineups');
            this.substitutes = data.lineups.find((g: any) => g.group === 'Substitutes');
          }

          // Procesar estadisticas
          if (data.stats && Array.isArray(data.stats)) {
            const globalStats = data.stats.find((s: any) => s.period === 'Match');
            this.matchStats = globalStats ? globalStats.stats : [];
          }
        }
        this.loading = false;
      },
      // Si no hay detalles se muestra solo la cabecera
      error: () => this.loading = false 
    });
  }

  /* --- Mejora la calidad de los escudos usando TheSportsDB --- */
  private upgradeImages(): void {
    // Equipo Local
    if (this.match.homeTeam) {
      this.sportService.searchTeams(this.match.homeTeam).subscribe(teams => {
        if (teams && teams.length > 0) {
          const hdLogo = teams[0].strTeamBadge || teams[0].strBadge;
          if (hdLogo) this.match.homeLogo = hdLogo;
        }
      });
    }
    // Equipo Visitante
    if (this.match.awayTeam) {
      this.sportService.searchTeams(this.match.awayTeam).subscribe(teams => {
        if (teams && teams.length > 0) {
          const hdLogo = teams[0].strTeamBadge || teams[0].strBadge;
          if (hdLogo) this.match.awayLogo = hdLogo;
        }
      });
    }
  }

  /* --- Generar Análisis o Pronóstico con IA (Gemini) --- */
  async generateAnalysis(): Promise<void> {
    this.aiLoading = true;
    this.aiError = false;
    this.cdr.detectChanges();

    try {
      const response = await this.aiService.generateMatchAnalysis(
        this.match.homeTeam, 
        this.match.awayTeam, 
        this.matchStats || [], // Si es null, pasamos array vacío
        this.match.league || 'La Liga', 
        this.hasRealStats
      );

      this.aiAnalysis = this.formatAiText(response);
      this.cdr.detectChanges();

    } catch (e) {
      console.error(e);
      this.aiError = true;
      this.cdr.detectChanges();
    } finally {
      this.aiLoading = false;
      this.cdr.detectChanges();
    }
  }

  /* --- Comprueba si las estadísticas no están todas a cero, el partido ha comenzado y tenemos estadísticas reales --- */
  get hasRealStats(): boolean {
    if (!this.matchStats || this.matchStats.length === 0) return false;
    
    // Busca si al menos un valor de todo el array es mayor que 0
    return this.matchStats.some(s => {
      // Limpiamos los posibles '%' para convertir a número
      const home = parseFloat(s.homeValue?.toString().replace('%', '')) || 0;
      const away = parseFloat(s.awayValue?.toString().replace('%', '')) || 0;
      return home > 0 || away > 0;
    });
  }

  /* --- Formatea el Markdown de la IA a HTML --- */
  private formatAiText(text: string): string {
    if (!text) return '';
    // Reemplaza **texto** por <strong>texto</strong>
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  /* --- Botón Volver  --- */
  goBack(): void {
    this.location.back();
  }

  /* --- Comprueba si el partido está en juego --- */
  isLive(status: string): boolean {
    if (!status) return false;
    // Finalizado (FT), Prórroga terminada (AET), Penaltis (PEN)
    return !['FT', 'AET', 'PEN', 'Finished'].includes(status) && !status.includes(':'); 
  }

  /* --- Cambia valores porcentuales por barras de progreso --- */
  getStatPercent(value: string): number {
    if (!value) return 0;
    const numberPart = value.split('%')[0].split('(')[0]; 
    return parseFloat(numberPart) || 0;
  }
}