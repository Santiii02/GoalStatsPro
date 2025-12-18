/*
 * MAPA DE NAVEGACIÓN DE LA APLICACIÓN.
 */

import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home';
import { MatchesComponent } from './features/matches/matches';
import { TeamsComponent } from './features/teams/teams';
import { PlayersComponent } from './features/players/players';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Inicio - GoalStatsPro' },
  { path: 'matches', component: MatchesComponent, title: 'Partidos - GoalStatsPro' },
  { path: 'teams', component: TeamsComponent, title: 'Equipos - GoalStatsPro' },
  { path: 'players', component: PlayersComponent, title: 'Jugadores - GoalStatsPro' },

  // Cualquier ruta desconocida redirige al Home
  { path: '**', redirectTo: '' }
];
