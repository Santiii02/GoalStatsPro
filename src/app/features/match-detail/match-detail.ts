/*
 *  INFORMACIÓN DETALLADA DEL PARTIDO.
 */

import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview'; 
import { TagModule } from 'primeng/tag';
import { SportDbService } from '../../services/sportdb.service';
import { AiService } from '../../services/ai.service';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-match-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, TabViewModule, TagModule, ProgressSpinnerModule, ChartModule, TooltipModule],
  templateUrl: './match-detail.html',
  styleUrl: './match-detail.css'
})
export class MatchDetailComponent implements OnInit, OnDestroy {

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
  groupedMatchStats: { category: string, stats: any[] }[] = [];
  matchSummary: any[] = []; 

  // Variables para la IA
  aiAnalysis: string | null = null;
  aiLoading: boolean = false;
  aiError: boolean = false;

  // Variables para el Gráfico
  radarData: any;
  radarOptions: any;

  // Variables para la Racha de los equipos (V-E-D)
  homeForm: string[] = [];
  awayForm: string[] = [];

  // Variable para el motor de tiempo real
  private pollingInterval: any = null;

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

  // Cuando el usuario abandona la página, detenemos el motor de tiempo real
  ngOnDestroy(): void {
    this.stopPolling();
  }

  /* --- Iniciar la vista con los datos disponibles --- */
  private initMatchData(data: any): void {
    this.match = this.normalizeBasicData(data);
    this.loading = false;
    this.loadMatchDetails();
    this.upgradeImages();  
    this.loadTeamForms();

    // Arrancamos el motor si el partido está en vivo o si faltan menos de 5 min para empezar
    let startsSoon = false;
    if (this.match.matchDate) {
      const diffMins = (this.match.matchDate.getTime() - new Date().getTime()) / 60000;
      startsSoon = diffMins >= -5 && diffMins <= 5;
    }

    if (this.isLive(this.match.status) || (this.match.status === 'Programado' && startsSoon)) {
      this.startPolling();
    }
  }

  /* --- Normaliza los datos --- */
  private normalizeBasicData(basic: any): any {
    
    // Parseamos la fecha
    let matchDate: Date | undefined;
    if (basic.processedDate) {
      matchDate = new Date(basic.processedDate); 
    } else if (basic.eventStartTime) {
      matchDate = new Date(Number(basic.eventStartTime) * 1000); 
    } else if (basic.startDateTimeUtc) {
      matchDate = new Date(basic.startDateTimeUtc); 
    }

    // Leemos lo que manda la API textualmente
    let rawStatus = String(basic.status || basic.eventStatus || '').toUpperCase();
    let currentStatus = 'Programado';

    // Listas de estados
    const finalStatuses = ['FT', 'FINISHED', 'FULL TIME', 'MATCH FINISHED', 'AET', 'PEN'];
    const halfTimeStatuses = ['HT', 'HALF TIME', 'HALF-TIME', 'HALFTIME'];
    const postponedStatuses = ['POSTPONED', 'PST', 'ABD', 'CANCELLED', 'CANCELED', 'CANC'];

    if (finalStatuses.includes(rawStatus)) {
      currentStatus = 'Finalizado'; 
    } else if (halfTimeStatuses.includes(rawStatus)) {
      currentStatus = 'Descanso';
    } else if (postponedStatuses.includes(rawStatus)) {
      currentStatus = 'Aplazado';
    } else if (rawStatus && !['UNDEFINED', 'NULL', 'NS', 'SCHEDULED', 'NOT STARTED'].includes(rawStatus)) {
      currentStatus = 'En vivo';
    } else {
      // Si la API no dice nada útil, usamos el reloj para empezar el partido a la hora prevista
      if (matchDate) {
        const diffMins = Math.floor((new Date().getTime() - matchDate.getTime()) / 60000);
        
        // Si es la hora, lo pasamos a En vivo automáticamente.
        // No adivinamos el descanso ni el final para respetar los descuentos reales.
        if (diffMins >= 0 && diffMins < 180) {
          currentStatus = 'En vivo';
        } else if (diffMins >= 180 && basic.homeScore !== undefined) {
          // Si han pasado 3 horas, hay resultado, y la API no ha actualizado el estado, finalizamos
          currentStatus = 'Finalizado';
        } else {
          currentStatus = 'Programado';
        }
      }
    }

    const realLeague = basic.tournamentName || basic.league || 'Competición Oficial';
    
    return {
      homeTeam: basic.homeName || basic.homeTeam,
      awayTeam: basic.awayName || basic.awayTeam,
      homeLogo: basic.homeLogo,
      awayLogo: basic.awayLogo,
      homeScore: basic.homeScore, 
      awayScore: basic.awayScore,
      status: currentStatus,
      league: realLeague,
      round: basic.round,
      eventId: basic.eventId || this.id,
      matchDate: matchDate,
      ...basic
    };
  }

  /* --- Cargar Alineaciones y Estadisticas --- */
  private loadMatchDetails(): void {
    this.loadingDetails = true;
    this.cdr.detectChanges();

    // Si el partido está en vivo, forzamos a la API a darnos datos frescos eliminando el cache local
    if (this.isLive(this.match?.status)) {
      localStorage.removeItem('goalstats_match_details_' + this.id);
    }

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
            this.groupStats();
            this.initRadarChart();
          }

          // Procesar Resumen (Eventos del partido)
          if (data.summary) {
            const rawEvents = data.summary.events || data.summary.incidents || data.summary;
            const eventsArray = Array.isArray(rawEvents) ? rawEvents : [rawEvents];

            // Limpiamos y organizamos estos datos
            this.processSummaryEvents(eventsArray);
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
  
  /* --- Cargar la Guía de Forma (Rachas V-E-D) --- */
  private loadTeamForms(): void {
    if (this.match.homeTeam) {
      this.sportService.getTeamForm(this.match.homeTeam).subscribe(form => this.homeForm = form);
    }
    if (this.match.awayTeam) {
      this.sportService.getTeamForm(this.match.awayTeam).subscribe(form => this.awayForm = form);
    }
  }

  /* --- Botón Volver  --- */
  goBack(): void {
    this.location.back();
  }

  /* --- Comprueba si el partido está en juego --- */
  isLive(status: string): boolean {
    if (!status) return false;
    return status === 'En vivo' || status === 'Descanso';
  }

/* --- MOTOR DE TIEMPO REAL (Polling) --- */
  private startPolling(): void {
    if (this.pollingInterval) return;

    // Refresca cada 120 segundos
    this.pollingInterval = setInterval(() => {
      this.refreshLiveEvents();
    }, 120000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /* --- Recargar eventos en vivo--- */
  refreshLiveEvents(): void {
    localStorage.removeItem('goalstats_live');
    localStorage.removeItem('goalstats_match_details_' + this.id);

    // Actualizamos solo los datos que pueden cambiar en vivo (marcador, eventos y estadísticas)
    forkJoin({
      basic: this.sportService.getMatchBasicInfo(this.id),
      details: this.sportService.getMatchDetails(this.id)
    }).subscribe({
      next: (res) => {
        
        if (res.basic) {
          const freshBasic = this.normalizeBasicData(res.basic);
          this.match.status = freshBasic.status;
          this.match.gameTime = freshBasic.gameTime;
          this.match.homeScore = freshBasic.homeScore;
          this.match.awayScore = freshBasic.awayScore;

          if (freshBasic.status === 'Finalizado') {
            this.stopPolling();
          }
        }

        if (res.details) {
          const data = res.details;

          if (data.summary) {
            const rawEvents = data.summary.events || data.summary.incidents || data.summary;
            const eventsArray = Array.isArray(rawEvents) ? rawEvents : [rawEvents];
            this.processSummaryEvents(eventsArray);
          }
          
          if (data.stats && Array.isArray(data.stats)) {
            const globalStats = data.stats.find((s: any) => s && s.period === 'Match');
            this.matchStats = globalStats ? globalStats.stats : [];
            this.groupStats();
            this.initRadarChart();
          }
        }
        
        this.cdr.detectChanges();
      }
    });
  }

/* --- Calcula el porcentaje proporcional de la barra entre los dos equipos --- */
  getStatPercent(homeVal: string, awayVal: string, isHome: boolean): number {
    // Extraemos el número limpio (quitando '%' o '(...)' )
    const extractNum = (val: string) => {
      if (!val) return 0;
      const numStr = val.toString().split('%')[0].split('(')[0].trim();
      return Math.abs(parseFloat(numStr)) || 0;
    };

    const home = extractNum(homeVal);
    const away = extractNum(awayVal);
    const total = home + away;

    // Si ambos tienen 0 (ej: 0 tarjetas rojas), dejamos la barra a cero para que no haya errores
    if (total === 0) return 0;

    return isHome ? (home / total) * 100 : (away / total) * 100;
  }

  /* --- Mapeo de colores para las insignias V-E-D --- */
  getFormColorClass(result: string): string {
    if (result === 'V') return 'form-win';
    if (result === 'E') return 'form-draw';
    if (result === 'D') return 'form-loss';
    return '';
  }

  /* --- Diccionario de Estadísticas (Inglés -> Español) --- */
  private statDictionary: Record<string, string> = {
    'Expected goals (xG)': 'Goles esperados (xG)',
    'xG on target (xGOT)': 'xG a puerta (xGOT)',
    'Ball possession': 'Posesión',
    'Total shots': 'Remates totales',
    'Shots on target': 'Remates a puerta',
    'Shots off target': 'Remates fuera',
    'Blocked shots': 'Remates rechazados',
    'Shots inside the box': 'Remates dentro del área',
    'Shots outside the box': 'Remates fuera del área',
    'Hit the woodwork': 'Al palo',
    'Big chances': 'Grandes ocasiones',
    'Corner kicks': 'Córneres',
    'Touches in opposition box': 'Toques en el área rival',
    'Accurate through passes': 'Pases entre líneas completados',
    'Offsides': 'Fueras de juego',
    'Free kicks': 'Tiros libres',
    'Passes': 'Pases',
    'Long passes': 'Pases largos',
    'Passes in final third': 'Pases en el tercio final',
    'Crosses': 'Centros',
    'Expected assists (xA)': 'Asistencias esperadas (xA)',
    'Throw ins': 'Saques de banda',
    'Fouls': 'Faltas',
    'Tackles': 'Entradas',
    'Duels won': 'Duelos ganados',
    'Clearances': 'Despejes',
    'Interceptions': 'Intercepciones',
    'Errors leading to shot': 'Errores conducentes a remate',
    'Errors leading to goal': 'Errores conducentes a gol',
    'Goalkeeper saves': 'Paradas',
    'Yellow cards': 'Tarjetas amarillas',
    'Red cards': 'Tarjetas rojas',
    'xGOT faced': 'xGOT enfrentados',
    'Goals prevented': 'Goles evitados'
  };

  /* --- Categorías de Estadísticas --- */
  private statCategoriesKeys = [
    { name: 'Estadísticas principales', keys: ['Expected goals (xG)', 'Ball possession', 'Total shots', 'Shots on target', 'Big chances', 'Corner kicks', 'Passes', 'Yellow cards', 'Red cards'] },
    { name: 'Remates', keys: ['Expected goals (xG)', 'xG on target (xGOT)', 'Total shots', 'Shots on target', 'Shots off target', 'Blocked shots', 'Shots inside the box', 'Shots outside the box', 'Hit the woodwork'] },
    { name: 'Ataque', keys: ['Big chances', 'Corner kicks', 'Touches in opposition box', 'Accurate through passes', 'Offsides', 'Free kicks'] },
    { name: 'Pases', keys: ['Passes', 'Long passes', 'Passes in final third', 'Crosses', 'Expected assists (xA)', 'Throw ins'] },
    { name: 'Defensa', keys: ['Fouls', 'Tackles', 'Duels won', 'Clearances', 'Interceptions', 'Errors leading to shot', 'Errors leading to goal'] },
    { name: 'Portería', keys: ['Goalkeeper saves', 'xGOT faced', 'Goals prevented'] }
  ];

  /* --- Agrupa las estadísticas en bloques --- */
  private groupStats(): void {
    if (!this.matchStats || this.matchStats.length === 0) return;

    this.groupedMatchStats = this.statCategoriesKeys.map(cat => {
      return {
        category: cat.name,
        // Busca cada estadística de la categoría en los datos de la API. Descartamos los "undefined" (si la API no manda ese dato).
        stats: cat.keys.map(key => this.matchStats.find(s => s.statName === key)).filter(s => s !== undefined)
      };
    }).filter(cat => cat.stats.length > 0);
  }

  /* --- Función Traductora --- */
  translateStat(statName: string): string {
    if (!statName) return '';
    return this.statDictionary[statName] || statName;
  }

  /* --- Diccionario de Explicaciones para estadísitcas --- */
  private statExplanations: Record<string, string> = {
    'Expected goals (xG)': 'Mide la calidad de una ocasión calculando la probabilidad de que un tiro termine en gol (basado en distancia, ángulo y tipo de pase).',
    'xG on target (xGOT)': 'Mide la calidad del tiro una vez que va a puerta, valorando si el disparo va a la escuadra o al centro para el portero.',
    'Expected assists (xA)': 'Mide la probabilidad de que un pase específico se convierta en una asistencia de gol.',
    'xGOT faced': 'La suma total de la calidad de los tiros a puerta (xGOT) a los que se ha enfrentado el portero.',
    'Goals prevented': 'Goles que ha salvado el portero. Se calcula restando los goles reales encajados al xGOT en contra. Un valor positivo es un rendimiento sobresaliente.',
    'Big chances': 'Una situación clara donde se espera razonablemente que el jugador marque (ej. un mano a mano o un remate muy cerca de la portería).'
  };

  /* --- Función para obtener la explicación --- */
  getStatExplanation(statName: string): string | undefined {
    if (!statName) return undefined;
    return this.statExplanations[statName] || undefined;
  }

  /* --- Función auxiliar para comprobar de quién es el evento --- */
  isHomeEvent(event: any): boolean {
    // Si la API tiene un campo team o participantTeam que coincida con el local
    return event.incidentParticipant === 1 || event.participantTeam === 'home' || event.team === 'home'; 
  }

/* --- Procesa la lista plana de eventos de la API y la agrupa por partes --- */
  private processSummaryEvents(rawEvents: any[]): void {
    const firstHalf: any[] = [];
    const secondHalf: any[] = [];

    rawEvents.forEach(ev => {
      // Extraer minuto del evento
      const rawTime = String(ev.time || ev.incidentTime || '-');
      const time = rawTime.replace(/'/g, '').replace(/"/g, '');

      // Extraer Nombres y detectar si es Cambio
      let mainName = '';
      let subName = '';
      let isSub = false;

      if (Array.isArray(ev.incidentPlayerName)) {
        isSub = true;
        subName = ev.incidentPlayerName[0] || '';   // Sale (Texto gris)
        mainName = ev.incidentPlayerName[1] || '';  // Entra (Negrita)
      } else {
        mainName = ev.incidentPlayerName || ev.playerName || '';
      }

      // Extraer el tipo de evento
      let typeRaw = String(ev.incidentType || ev.type || ev.incidentClass || '').toLowerCase();
      let comment = String(ev.incidentCommentary || '').toLowerCase();

      let finalType = '';
      if (typeRaw.includes('goal') || comment.includes('goal')) finalType = 'goal';
      else if (typeRaw.includes('yellow') || comment.includes('yellow')) finalType = 'yellow';
      else if (typeRaw.includes('red') || comment.includes('red')) finalType = 'red';
      else if (typeRaw.includes('sub') || comment.includes('substitut') || isSub) finalType = 'sub';
      else finalType = typeRaw;

      // Detectar si el evento es para el equipo local o visitante si la API no lo especifica
      let isHome = true;
      if (ev.incidentParticipant !== undefined) {
          isHome = (ev.incidentParticipant == 1);
      } else if (ev.participant !== undefined) {
          isHome = (ev.participant == 1);
      } else if (ev.participantTeam) {
          isHome = (ev.participantTeam === 'home' || ev.participantTeam == 1);
      } else if (mainName) {
          // Buscamos su nombre en la alineación visitante
          const searchName = mainName.toLowerCase().split(' ')[0]; 
          const awayLineup = this.startingLineups?.away || [];
          const awaySubs = this.substitutes?.away || [];
          
          const isAwayPlayer = [...awayLineup, ...awaySubs].some((p: any) =>
              String(p.participantName).toLowerCase().includes(searchName)
          );
          if (isAwayPlayer) isHome = false;
      }

      let reason = ev.incidentReason || ev.detail || '';

      // Penalti y Gol en Propia Puerta
      if (finalType === 'goal') {
          // Si el jugador y la asistencia son el mismo, es un penalti
          if (mainName && mainName === subName) {
              subName = '';
              if (!reason) reason = 'Penalti';
          } 
          // Por si la API manda el texto en los comentarios
          else if (comment.includes('penalty') || comment.includes('penalti')) {
              if (!reason) reason = 'Penalti';
          }
          // Goles en Propia Puerta (Own Goal)
          else if (comment.includes('own goal') || comment.includes('propia')) {
              if (!reason) reason = 'P.P.';
          }
      }

      // Información normalizada del evento para mostrar en la UI
      const normalizedEvent = {
        time: time,
        type: finalType,
        mainName: mainName,
        subName: subName,
        homeScore: ev.homeScore,
        awayScore: ev.awayScore,
        isHome: isHome,
        reason: reason
      };

      if (ev.incidentHalf == 1 || ev.incidentHalf === '1') firstHalf.push(normalizedEvent);
      else secondHalf.push(normalizedEvent);
    });

    this.matchSummary = [];
    if (firstHalf.length > 0) this.matchSummary.push({ stageName: '1ER TIEMPO', events: firstHalf });
    if (secondHalf.length > 0) this.matchSummary.push({ stageName: '2º TIEMPO', events: secondHalf });
  }
}