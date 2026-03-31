/*
 * SERVICIO DE AUTENTICACIÓN (FIREBASE AUTH)
 */

import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, authState, User } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Inyectamos el servicio Auth de Firebase
  private auth = inject(Auth);

  // Observable que nos dirá en tiempo real si el usuario está conectado o no
  public readonly user$: Observable<User | null> = authState(this.auth);

  constructor() {}

  /* --- REGISTRAR UN NUEVO USUARIO --- */
  register(email: string, password: string): Promise<any> {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  /* --- INICIAR SESIÓN --- */
  login(email: string, password: string): Promise<any> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  /* --- CERRAR SESIÓN --- */
  logout(): Promise<void> {
    return signOut(this.auth);
  }

  /* --- OBTENER EL USUARIO ACTUAL --- */
  get currentUser(): User | null {
    return this.auth.currentUser;
  }
}