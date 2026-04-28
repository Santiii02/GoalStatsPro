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
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

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
}