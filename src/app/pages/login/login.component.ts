import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  senha = '';
  readonly erro = signal<string | null>(null);
  readonly loading = signal(false);

  submit(): void {
    this.erro.set(null);
    this.loading.set(true);
    this.auth.login(this.email.trim(), this.senha).subscribe({
      next: () => {
        this.loading.set(false);
        const dest = this.auth.isAdmin() ? '/admin/pedidos' : '/loja';
        void this.router.navigateByUrl(dest);
      },
      error: (e) => {
        this.loading.set(false);
        this.erro.set(e.error?.error ?? 'Falha no login.');
      },
    });
  }
}
