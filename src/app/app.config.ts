/*
 * CONFIGURACIÓN GLOBAL DE LA APLICACIÓN (Standalone).
 */

import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; 

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Optimización de detección de cambios 
    provideZoneChangeDetection({ eventCoalescing: true }),

    // Configuración de Rutas
    provideRouter(routes, withComponentInputBinding()),

    // Habilita el uso de HttpClient en toda la app
    provideHttpClient()
  ]
};
