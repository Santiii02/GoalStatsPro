/*
 * VIGILANTE DE RUTAS: ADMINISTRADOR (GUARD)
 * Protege las rutas sensibles comprobando en Firestore si el usuario tiene el rol 'admin'
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';


export const adminGuard: CanActivateFn = async (route, state) => {
  // Inyectamos los servicios necesarios para comprobar el rol del usuario
  const userService = inject(UserService);
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    // Esperamos a que Firebase termine de arrancar y nos de una respuesta definitiva
    const user = await firstValueFrom(authService.user$);

    // Si no hay sesión, lo expulsamos
    if (!user) {
      router.navigate(['/']);
      return false;
    }

    // Si hay usuario, obtenemos su rol
    const role = await userService.getUserRole();

    if (role === 'admin') {
      return true; // Concedemos acceso al admin
    } else {
      router.navigate(['/']); // Redirigimos a inicio si no es admin
      return false;
    }
  } catch (error) {
    console.error('Error en el Guard de Admin', error);
    router.navigate(['/']);
    return false;
  }
};