/*
 * SERVICIO DE USUARIOS Y BASE DE DATOS (FIRESTORE)
 * Gestiona la lectura y escritura de datos personalizados del usuario
 */

import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, arrayUnion, arrayRemove, collection, getDocs} from '@angular/fire/firestore';
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

  /* --- Obtenemos los equipos favoritos --- */
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

  /* --- Añadir o quitar equipo de favoritos, el email del usuario se guarda en el documento --- */
  async toggleFavorite(teamName: string, isCurrentlyFavorite: boolean): Promise<void> {
    try {
      const docRef = this.getUserDocRef();
      const user = this.authService.currentUser;

      if (isCurrentlyFavorite) {
        // Si ya era favorito, lo eliminamos de la base de datos
        // Eliminamos solo el equipo del array, no el documento completo
        await setDoc(docRef, {
          email: user?.email,
          favoriteTeams: arrayRemove(teamName)
        }, { merge: true }); // merge:true para no borrar otros campos del documento
        
      } else {
        // Si no era favorito, lo añadimos
        await setDoc(docRef, {
          email: user?.email,
          favoriteTeams: arrayUnion(teamName)
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error al actualizar el favorito:', error);
      throw error;
    }
  }

  /* --- Obtenemos el rol del usuario --- */
  async getUserRole(): Promise<string> {
    try {
      const user = this.authService.currentUser;
      if (!user) return 'user'; // Si no hay sesión, es un usuario normal

      // Documento del usuario en Firestore
      const docRef = this.getUserDocRef();
      const docSnap = await getDoc(docRef);

      // Si el documento existe, devolvemos su rol. Si no, asumimos que es un usuario normal
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data['role'] || 'user';
      } else {
        return 'user';
      }
    } catch (error) {
      console.error('Error al obtener el rol del usuario:', error);
      return 'user';
    }
  }


  /* --- Obtenemos todos los usuarios (Solo para Admin) --- */
  async getAllUsers(): Promise<any[]> {
    try {
      // Obtenemos todos los documentos de la colección 'users'
      const usersRef = collection(this.firestore, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      // Mapeamos los documentos a un array de objetos legibles
      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error al obtener la lista de usuarios:', error);
      throw error;
    }
  }
}