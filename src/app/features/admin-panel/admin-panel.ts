/*
 * PANEL DE ADMINISTRACIÓN PARA ADMINISTRADORES
 */
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.css'
})
export class AdminPanelComponent implements OnInit {
  // Inyección de dependencias
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);

  // Variables para la tabla de usuarios
  users: any[] = [];
  loading: boolean = true;

  ngOnInit(): void {
    this.loadUsers();
  }

  /* --- Cargar usuarios --- */
  async loadUsers() {
    this.loading = true;
    try {
      this.users = await this.userService.getAllUsers();
    } catch (error) {
      console.error("No se pudieron cargar los usuarios", error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  /* --- Borrar usuario --- */
  async deleteUser(uid: string) {
    // Pedimos confirmación al administrador para evitar accidentes
    const confirmed = globalThis.confirm('¿Estás seguro de que quieres eliminar los datos de este usuario? Esta acción no se puede deshacer.');
    
    if (confirmed) {
      try {
        await this.userService.deleteUserDocument(uid);
        
        // Volvemos a cargar la lista para que el usuario desaparezca de la tabla visualmente
        this.loadUsers();
      } catch (error) {
        console.error("Error al borrar el usuario", error);
        alert('Hubo un error al intentar borrar el usuario.');
      }
    }
  }
}