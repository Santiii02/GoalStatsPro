/*
 * SERVICIO DE USUARIOS Y BASE DE DATOS (FIRESTORE)
 * Gestiona la lectura y escritura de datos personalizados del usuario
 */

import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, arrayUnion, arrayRemove, collection, getDocs, deleteDoc, updateDoc} from '@angular/fire/firestore';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  // Inyección de dependencias
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);

  /* --- Obtenemos una referencia al documento del usuario en Firestore --- */
  private getUserDocRef() {
    const user = this.authService.currentUser;
    if (!user) throw new Error('No hay un usuario autenticado');
    
    // Apunta a la colección 'users' y al documento con el UID del usuario
    return doc(this.firestore, `users/${user.uid}`);
  }

  /* --- Obtenemos los equipos favoritos --- */
  async getFavoriteTeams(): Promise<string[]> {
    try {
      // Documento del usuario en Firestore
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

  /* --- Añadir o quitar equipo de favoritos --- */
  async toggleFavorite(teamName: string, isCurrentlyFavorite: boolean): Promise<void> {
    try {
      const user = this.authService.currentUser;
      if (!user) throw new Error('No hay un usuario autenticado');

      const docRef = this.getUserDocRef();
      const docSnap = await getDoc(docRef);

      // Si el documento fue borrado por el admin le cerramos la sesión de golpe
      if (!docSnap.exists()) {
        await this.authService.logout();
        throw new Error('Cuenta eliminada por el administrador. Sesión cerrada.');
      }

      // Añadimos o quitamos de favoritos
      if (isCurrentlyFavorite) {
        await updateDoc(docRef, { favoriteTeams: arrayRemove(teamName) });
      } else {
        await updateDoc(docRef, { favoriteTeams: arrayUnion(teamName) });
      }
    } catch (error) {
      console.error('Error al actualizar equipo favorito:', error);
      throw error;
    }
  }

  /* --- Obtener IDs de Jugadores Favoritos --- */
  async getFavoritePlayers(): Promise<string[]> {
    try {
      // Documento del usuario en Firestore
      const docRef = this.getUserDocRef();
      const docSnap = await getDoc(docRef);

      // Si el documento existe, devolvemos su array de favoritos. Si no, array vacío.
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data['favoritePlayers'] || [];
      }
      return [];
    } catch (error) {
      console.error("Error obteniendo jugadores favoritos:", error);
      return [];
    }
  }

  /* --- Añadir/Quitar Jugador Favorito --- */
  async toggleFavoritePlayer(playerId: string, isCurrentlyFavorite: boolean): Promise<void> {
    try {
      const user = this.authService.currentUser;
      if (!user) throw new Error('No hay un usuario autenticado');

      const docRef = this.getUserDocRef();
      const docSnap = await getDoc(docRef);

      // Si el documento fue borrado por el admin le cerramos la sesión de golpe
      if (!docSnap.exists()) {
        await this.authService.logout();
        throw new Error('Cuenta eliminada por el administrador. Sesión cerrada.');
      }

      // Añadimos o quitamos de favoritos
      if (isCurrentlyFavorite) {
        await updateDoc(docRef, { favoritePlayers: arrayRemove(playerId) });
      } else {
        await updateDoc(docRef, { favoritePlayers: arrayUnion(playerId) });
      }
    } catch (error) {
      console.error("Error al actualizar jugador favorito:", error);
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

  /* --- Elimina documento de usuario (Solo para Admin) --- */
  async deleteUserDocument(uid: string): Promise<void> {
    try {
      // Documento exacto del usuario que el admin quiere borrar
      const userDocRef = doc(this.firestore, `users/${uid}`);
      await deleteDoc(userDocRef);
    } catch (error) {
      console.error('Error al eliminar el documento del usuario:', error);
      throw error;
    } 
  }

  /* --- Crear documento inicial del usuario --- */
  async createInitialUserDocument(uid: string, email: string | null): Promise<void> {
    if (!email) return;
    
    try {
      const userDocRef = doc(this.firestore, `users/${uid}`);
      await setDoc(userDocRef, {
        email: email,
        role: 'user', 
        favoriteTeams: [],
        favoritePlayers: []
      });
    } catch (error) {
      console.error('Error al crear el documento base del usuario:', error);
      throw error;
    }
  }
}