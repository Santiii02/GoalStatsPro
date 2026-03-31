/* 
 * COMPONENTE RAIZ DE LA APLICACIÓN.
 */

import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/navbar/navbar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, NavbarComponent, ButtonModule, TooltipModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent {
  title = 'GoalStatsPro';

  // Inyectamos Firebase
  public authService = inject(AuthService);
  private router = inject(Router);

  /* --- Cerrar Sesión --- */
  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      this.router.navigate(['/']); // Redirigir al inicio tras salir
    } catch (error) {
      console.error('Error al cerrar sesión', error);
    }
  }
}
