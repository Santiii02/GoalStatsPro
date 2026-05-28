/* 
 * COMPONENTE RAIZ DE LA APLICACIÓN.
 */

import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/navbar/navbar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, NavbarComponent, ButtonModule, TooltipModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit{
  title = 'GoalStatsPro';

  // Variable para controlar la visibilidad de opciones de admin
  isAdmin: boolean = false;

  // Inyección de dependencias
  public authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);

  ngOnInit(): void {
    this.checkAdminRole();
  }

  /* --- Cerrar Sesión --- */
  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      this.router.navigate(['/']); // Redirigir al inicio tras salir
    } catch (error) {
      console.error('Error al cerrar sesión', error);
    }
  }

  /* --- Comprobar Rol de Admin --- */
  async checkAdminRole() {
    this.authService.user$.subscribe(async user => {
      if (user) {
        const role = await this.userService.getUserRole();
        this.isAdmin = (role === 'admin');
      } else {
        this.isAdmin = false;
      }
    });
  }
}
