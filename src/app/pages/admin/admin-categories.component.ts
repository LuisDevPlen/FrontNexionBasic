import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService, Categoria } from '../../core/catalog.service';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.scss',
})
export class AdminCategoriesComponent implements OnInit {
  private readonly catalog = inject(CatalogService);

  readonly lista = signal<Categoria[]>([]);
  readonly erro = signal<string | null>(null);
  readonly msg = signal<string | null>(null);

  novaNome = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.erro.set(null);
    this.catalog.listCategorias().subscribe({
      next: (c) => this.lista.set(c),
      error: () => this.erro.set('Erro ao carregar categorias.'),
    });
  }

  salvar(): void {
    const n = this.novaNome.trim();
    if (!n) {
      this.erro.set('Informe o nome da categoria.');
      return;
    }
    this.erro.set(null);
    this.msg.set(null);
    this.catalog.createCategoria(n).subscribe({
      next: () => {
        this.msg.set('Categoria cadastrada.');
        this.novaNome = '';
        this.load();
      },
      error: (e) => this.erro.set(e.error?.error ?? 'Erro ao cadastrar.'),
    });
  }

  remover(c: Categoria): void {
    if (!confirm(`Remover "${c.nome}"? Produtos usando esta categoria ficam sem categoria.`)) return;
    this.catalog.deleteCategoria(c.id).subscribe({
      next: () => {
        this.msg.set('Categoria removida.');
        this.load();
      },
      error: (e) => this.erro.set(e.error?.error ?? 'Erro ao remover.'),
    });
  }
}
