/*
 * SERVICIO DE AUTENTICACIÓN (FIREBASE AUTH)
 */

import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, authState, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Inyectamos el servicio Auth de Firebase
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  // Observable que nos dirá en tiempo real si el usuario está conectado o no
  public readonly user$: Observable<User | null> = authState(this.auth);

  constructor() { }

  /* --- REGISTRAR UN NUEVO USUARIO --- */
  async register(email: string, password: string): Promise<any> {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);

    // Después de crear el usuario, creamos su documento en Firestore con datos iniciales
    const userDocRef = doc(this.firestore, `users/${userCredential.user.uid}`);
    await setDoc(userDocRef, {
      email: email,
      role: 'user',
      favoriteTeams: [],
      favoritePlayers: []
    });

    return userCredential;
  }

  /* --- INICIAR SESIÓN Y VERIFICAR BORRADO --- */
  async login(email: string, password: string): Promise<any> {
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);

    // Comprobamos si el admin ha borrado el documento del usuario en Firestore
    const userDocRef = doc(this.firestore, `users/${userCredential.user.uid}`);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      // Forzamos el cierre de sesión inmediatamente y bloqueamos el acceso
      await this.logout();
      throw new Error('admin_deleted');
    }

    return userCredential;
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