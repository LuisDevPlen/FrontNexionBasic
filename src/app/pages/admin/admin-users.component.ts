import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserAdminService, UsuarioLista } from '../../core/user-admin.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  private readonly api = inject(UserAdminService);

  readonly usuarios = signal<UsuarioLista[]>([]);
  readonly erro = signal<string | null>(null);
  readonly msg = signal<string | null>(null);

  nome = '';
  email = '';
  senha = '';
  papel: 'admin' | 'cliente' = 'cliente';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.erro.set(null);
    this.api.list().subscribe({
      next: (u) => this.usuarios.set(u),
      error: () => this.erro.set('Erro ao listar usuários.'),
    });
  }

  criar(): void {
    this.msg.set(null);
    if (!this.nome.trim() || !this.email.trim() || !this.senha) {
      this.erro.set('Preencha nome, e-mail e senha.');
      return;
    }
    this.erro.set(null);
    this.api
      .create({
        nome: this.nome.trim(),
        email: this.email.trim(),
        senha: this.senha,
        papel: this.papel,
      })
      .subscribe({
        next: () => {
          this.msg.set('Usuário criado.');
          this.nome = '';
          this.email = '';
          this.senha = '';
          this.papel = 'cliente';
          this.load();
        },
        error: (e) => this.erro.set(e.error?.error ?? 'Erro ao criar.'),
      });
  }

  alterarPapel(u: UsuarioLista, papel: 'admin' | 'cliente'): void {
    this.msg.set(null);
    this.api.setRole(u.id, papel).subscribe({
      next: () => {
        this.msg.set('Papel atualizado.');
        this.load();
      },
      error: (e) => this.erro.set(e.error?.error ?? 'Erro ao atualizar papel.'),
    });
  }
}
