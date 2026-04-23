/*
 * SERVICIO DE USUARIOS Y BASE DE DATOS (FIRESTORE)
 * Gestiona la lectura y escritura de datos personalizados del usuario
 */

import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, arrayUnion, arrayRemove } from '@angular/fire/firestore';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  // Inyección de dependencias
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  /*
   * OBTENEMOS UNA REFERENCIA AL DOCUMENTO DEL USUARIO EN FIRESTORE
   */
  private getUserDocRef() {
    const user = this.authService.currentUser;
    if (!user) throw new Error('No hay un usuario autenticado');
    
    // Apunta a la colección 'users' y al documento con el UID del usuario
    return doc(this.firestore, `users/${user.uid}`);
  }

  /*
   * OBTENER LOS EQUIPOS FAVORITOS
   */
  async getFavoriteTeams(): Promise<string[]> {
    try {
      const user = this.authService.currentUser;
      if (!user) return []; // Si es un usuario sin cuenta, devolvemos array vacío

      const docRef = this.getUserDocRef();
      const docSnap = await getDoc(docRef);

      // Si el documento existe, devolvemos su array de favoritos. Si no, array vacío.
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data['favoriteTeams'] || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error al obtener los favoritos de Firestore:', error);
      return [];
    }
  }

  /*
   * AÑADIR O QUITAR UN EQUIPO DE FAVORITOS
   */  
  async toggleFavorite(teamName: string, isCurrentlyFavorite: boolean): Promise<void> {
    try {
      const docRef = this.getUserDocRef();

      if (isCurrentlyFavorite) {
        // Si ya era favorito, lo eliminamos de la base de datos
        // Eliminamos solo el equipo del array, no el documento completo
        await setDoc(docRef, {
          favoriteTeams: arrayRemove(teamName)
        }, { merge: true }); // merge:true para no borrar otros campos del documento
        
      } else {
        // Si no era favorito, lo añadimos
        await setDoc(docRef, {
          favoriteTeams: arrayUnion(teamName)
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error al actualizar el favorito:', error);
      throw error;
    }
  }
}