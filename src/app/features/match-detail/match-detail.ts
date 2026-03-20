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
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'app-match-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, TabViewModule, TagModule, ProgressSpinnerModule, ChartModule],
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
  loadingDetails: boolean = true;
  activeTab: number = 0; // 0: Alineaciones, 1: Estadisticas

  startingLineups: any = null;
  substitutes: any = null;
  matchStats: any[] = [];

  // Variables para la IA
  aiAnalysis: string | null = null;
  aiLoading: boolean = false;
  aiError: boolean = false;

  // Variables para el Gráfico
  radarData: any;
  radarOptions: any;

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
    this.loadingDetails = true;
    this.cdr.detectChanges();

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
            const globalStats = data.stats.find((s: any) => s && s.period === 'Match');
            this.matchStats = globalStats ? globalStats.stats : [];
            this.initRadarChart();
          }
        }
        this.loadingDetails = false;   
        this.cdr.detectChanges();
      },
      // Si no hay detalles se muestra solo la cabecera
      error: () => {
        this.loadingDetails = false;
        this.cdr.detectChanges();
      }
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

/* --- Configurar Gráfico de Radar (Escala Proporcional de Dominio) --- */
  private initRadarChart(): void {
    // Si no hay estadísticas, no hacemos nada
    if (!this.matchStats || this.matchStats.length === 0) return;

    // Elegimos y definimos métricas a mostrar
    const searchKeys = ['possession', 'total shots', 'corner', 'fouls', 'duels won'];
    const labels = ['Posesión', 'Tiros Totales', 'Córners', 'Faltas', 'Duelos Ganados'];
    
    // Arrays para guardar los porcentajes calculados para pintar el gráfico (0-100%)
    const homeData: number[] = [];
    const awayData: number[] = [];
    
    // Arrays para guardar el dato real
    const realHomeValues: string[] = [];
    const realAwayValues: string[] = [];

    // Procesamos cada estadística
    searchKeys.forEach(key => {
      const stat = this.matchStats.find(s => 
        s.statName && s.statName.toLowerCase().includes(key)
      );
      
      const homeRaw = stat?.homeValue?.toString() || '0';
      const awayRaw = stat?.awayValue?.toString() || '0';
      
      realHomeValues.push(homeRaw);
      realAwayValues.push(awayRaw);

      // Limpiamos los strings, eliminamos los símbolos de porcentaje y los paréntesis
      const homeNum = parseFloat(homeRaw.split('%')[0].split('(')[0]) || 0;
      const awayNum = parseFloat(awayRaw.split('%')[0].split('(')[0]) || 0;

      // Calculamos el dominio de cada estadística como un porcentaje del total (home + away)
      const total = homeNum + awayNum;
      if (total === 0) {
        homeData.push(0);
        awayData.push(0);
      } else {
        homeData.push(Math.round((homeNum / total) * 100));
        awayData.push(Math.round((awayNum / total) * 100));
      }
    });

    // Configuración visual del Gráfico
    this.radarData = {
      labels: labels,
      datasets: [
        {
          label: this.match.homeTeam,
          backgroundColor: 'rgba(59, 130, 246, 0.2)', 
          borderColor: 'rgba(59, 130, 246, 1)',
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
          data: homeData
        },
        {
          label: this.match.awayTeam,
          backgroundColor: 'rgba(239, 68, 68, 0.2)', 
          borderColor: 'rgba(239, 68, 68, 1)',
          pointBackgroundColor: 'rgba(239, 68, 68, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(239, 68, 68, 1)',
          data: awayData
        }
      ]
    };

    // Personalizamos el aspecto de la leyenda, los ejes y reescribimos los Tooltips.
    this.radarOptions = {
      plugins: {
        legend: {
          labels: { color: '#495057' }
        },
        tooltip: {
          callbacks: {
            // Reemplazamos el texto del Tooltip por el valor real de la estadística
            label: function(context: any) {
              const isHome = context.datasetIndex === 0;
              const realVal = isHome ? realHomeValues[context.dataIndex] : realAwayValues[context.dataIndex];
              return `${context.dataset.label}: ${realVal} (Dominio: ${context.raw}%)`;
            }
          }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 100, // Fijamos el límite del radar en 100% para que sea una telaraña perfecta
          grid: { color: '#e9ecef' },
          pointLabels: { color: '#6c757d', font: { size: 11, weight: 'bold' } },
          ticks: { display: false } 
        }
      }
    };
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