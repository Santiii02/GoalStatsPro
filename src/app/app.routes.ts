/*
 * MAPA DE NAVEGACIÓN DE LA APLICACIÓN.
 */

import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home';
import { MatchesComponent } from './features/matches/matches';
import { TeamsComponent } from './features/teams/teams';
import { PlayersComponent } from './features/players/players';
import { TeamDetailComponent } from './features/team-detail/team-detail';
import { PlayerDetailComponent } from './features/player-detail/player-detail';
import { MatchDetailComponent } from './features/match-detail/match-detail';
import { LoginComponent } from './features/auth/login';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Inicio - GoalStatsPro' },
  { path: 'matches', component: MatchesComponent, title: 'Partidos - GoalStatsPro' },
  { path: 'teams', component: TeamsComponent, title: 'Equipos - GoalStatsPro' },
  { path: 'players', component: PlayersComponent, title: 'Jugadores - GoalStatsPro' },
  { path: 'team/:name', component: TeamDetailComponent, title: 'Equipo - GoalStatsPro' },
  { path: 'player/:id', component: PlayerDetailComponent, title: 'Jugador - GoalStatsPro' },
  { path: 'match/:id', component: MatchDetailComponent, title: 'Partido - GoalStatsPro' },
  { path: 'login', component: LoginComponent, title: 'Login - GoalStatsPro' },

  // Cualquier ruta desconocida redirige al Home
  { path: '**', redirectTo: '' }
];
