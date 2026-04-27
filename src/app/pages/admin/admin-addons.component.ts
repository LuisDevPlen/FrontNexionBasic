import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService, Adicional } from '../../core/catalog.service';

@Component({
  selector: 'app-admin-addons',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-addons.component.html',
  styleUrl: './admin-addons.component.scss',
})
export class AdminAddonsComponent implements OnInit {
  private readonly catalog = inject(CatalogService);

  readonly lista = signal<Adicional[]>([]);
  readonly erro = signal<string | null>(null);
  readonly msg = signal<string | null>(null);

  nome = '';
  preco: number | null = 0;
  descricao = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.erro.set(null);
    this.catalog.listAdicionais().subscribe({
      next: (a) => this.lista.set(a),
      error: () => this.erro.set('Erro ao carregar adicionais.'),
    });
  }

  fmtPreco(a: Adicional): string {
    return Number(a.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  salvar(): void {
    const n = this.nome.trim();
    if (!n || this.preco == null) {
      this.erro.set('Nome e preço são obrigatórios.');
      return;
    }
    this.erro.set(null);
    this.msg.set(null);
    this.catalog
      .createAdicional({
        nome: n,
        preco: this.preco,
        descricao: this.descricao || null,
      })
      .subscribe({
        next: () => {
          this.msg.set('Adicional cadastrado.');
          this.nome = '';
          this.preco = 0;
          this.descricao = '';
          this.load();
        },
        error: (e) => this.erro.set(e.error?.error ?? 'Erro ao cadastrar.'),
      });
  }

  remover(a: Adicional): void {
    if (!confirm(`Remover "${a.nome}"?`)) return;
    this.catalog.deleteAdicional(a.id).subscribe({
      next: () => {
        this.msg.set('Adicional removido.');
        this.load();
      },
      error: (e) => this.erro.set(e.error?.error ?? 'Erro ao remover.'),
    });
  }
}
