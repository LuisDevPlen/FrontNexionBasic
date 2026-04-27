import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  nome = '';
  email = '';
  senha = '';
  readonly erro = signal<string | null>(null);
  readonly loading = signal(false);

  submit(): void {
    this.erro.set(null);
    this.loading.set(true);
    this.auth.register(this.nome.trim(), this.email.trim(), this.senha).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl('/loja');
      },
      error: (e) => {
        this.loading.set(false);
        this.erro.set(e.error?.error ?? 'Não foi possível cadastrar.');
      },
    });
  }
}
