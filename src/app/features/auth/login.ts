/*
 *  AUTENTICACIÓN (LOGIN / REGISTRO)
 */

import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        CardModule,
        InputTextModule,
        PasswordModule,
        ButtonModule,
        MessageModule,
    ],
    templateUrl: './login.html',
    styleUrl: './login.css',
})
export class LoginComponent {
    // Inyección de dependencias
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly cdr = inject(ChangeDetectorRef);

    // Variables del formulario
    email: string = '';
    password: string = '';

    // Estado de la vista
    isLoginMode: boolean = true; // true = Iniciar sesión, false = Registrarse
    isLoading: boolean = false;
    errorMessage: string | null = null;

    /* --- Cambia entre el modo Login y Registro --- */
    toggleMode(): void {
        this.isLoginMode = !this.isLoginMode;
        this.errorMessage = null;
    }

    /* --- Envía el formulario a Firebase --- */
    async onSubmit(): Promise<void> {
        // Validación básica de campos vacíos
        if (!this.email || !this.password) {
            this.errorMessage = 'Por favor, rellena todos los campos.';
            return;
        }

        this.isLoading = true;
        this.errorMessage = null;
        this.cdr.detectChanges();

        try {
            if (this.isLoginMode) {
                // Modo Inicio de Sesión
                await this.authService.login(this.email, this.password);
            } else {
                // Modo Registro
                await this.authService.register(this.email, this.password);
            }

            // Si todo va bien, redirigimos al inicio
            this.router.navigate(['/']);
        } catch (error: any) {
            // Capturamos y traducimos el error para el usuario
            const errorCode = error.code || error.message;
            this.handleFirebaseError(errorCode);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    /* --- Traductor de Errores de Firebase --- */
    private handleFirebaseError(code: string): void {
        switch (code) {
            case 'admin_deleted':
                this.errorMessage = 'Tu cuenta ha sido eliminada por un administrador del sistema.';
                break;
            case 'auth/invalid-credential':
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                this.errorMessage = 'Correo o contraseña incorrectos.';
                break;
            case 'auth/email-already-in-use':
                this.errorMessage = 'Este correo ya está registrado.';
                break;
            case 'auth/weak-password':
                this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
                break;
            case 'auth/invalid-email':
                this.errorMessage = 'El formato del correo no es válido.';
                break;
            default:
                this.errorMessage = 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';
                console.error('Firebase Auth Error:', code);
        }
    }
}
