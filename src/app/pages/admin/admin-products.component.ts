import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductService, Produto } from '../../core/product.service';
import {
  CatalogService,
  Categoria,
  Adicional,
} from '../../core/catalog.service';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.scss',
})
export class AdminProductsComponent implements OnInit {
  private readonly api = inject(ProductService);
  private readonly catalog = inject(CatalogService);

  readonly lista = signal<Produto[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly adicionais = signal<Adicional[]>([]);
  readonly erro = signal<string | null>(null);
  readonly msg = signal<string | null>(null);

  nome = '';
  preco: number | null = null;
  descricao = '';
  categoriaId: number | '' = '';
  imagem_url = '';
  adicionalIdsSelecionados: number[] = [];

  editing = signal<Produto | null>(null);

  ngOnInit(): void {
    this.reloadAll();
  }

  reloadAll(): void {
    this.erro.set(null);
    forkJoin({
      produtos: this.api.list(),
      categorias: this.catalog.listCategorias(),
      adicionais: this.catalog.listAdicionais(),
    }).subscribe({
      next: ({ produtos, categorias, adicionais }) => {
        this.lista.set(produtos);
        this.categorias.set(categorias);
        this.adicionais.set(adicionais);
      },
      error: () => this.erro.set('Erro ao carregar dados.'),
    });
  }

  loadProdutos(): void {
    this.api.list().subscribe({
      next: (p) => this.lista.set(p),
      error: () => this.erro.set('Erro ao listar produtos.'),
    });
  }

  fmtPreco(n: string | number): string {
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  fmtProduto(p: Produto): string {
    return Number(p.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  categoriaLabel(p: Produto): string {
    return p.categoria_nome ?? p.categoria ?? '—';
  }

  startEdit(p: Produto): void {
    this.editing.set(p);
    this.nome = p.nome;
    this.preco = Number(p.preco);
    this.descricao = p.descricao ?? '';
    this.categoriaId = p.categoria_id ?? '';
    this.imagem_url = p.imagem_url ?? '';
    this.adicionalIdsSelecionados = (p.adicionais ?? []).map((a) => a.id);
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.resetForm();
  }

  resetForm(): void {
    this.nome = '';
    this.preco = null;
    this.descricao = '';
    this.categoriaId = '';
    this.imagem_url = '';
    this.adicionalIdsSelecionados = [];
  }

  toggleAdicional(id: number): void {
    const i = this.adicionalIdsSelecionados.indexOf(id);
    if (i >= 0) {
      this.adicionalIdsSelecionados = this.adicionalIdsSelecionados.filter((x) => x !== id);
    } else {
      this.adicionalIdsSelecionados = [...this.adicionalIdsSelecionados, id];
    }
  }

  isAdicionalChecked(id: number): boolean {
    return this.adicionalIdsSelecionados.includes(id);
  }

  save(): void {
    this.msg.set(null);
    if (!this.nome.trim() || this.preco == null) {
      this.erro.set('Nome e preço são obrigatórios.');
      return;
    }
    this.erro.set(null);

    const body = {
      nome: this.nome.trim(),
      preco: this.preco,
      descricao: this.descricao || null,
      imagem_url: this.imagem_url || null,
      categoria_id:
        this.categoriaId === '' ? null : Number(this.categoriaId),
      adicional_ids: [...this.adicionalIdsSelecionados],
    };

    const cur = this.editing();
    if (cur) {
      this.api.update(cur.id, body).subscribe({
        next: () => {
          this.msg.set('Produto atualizado.');
          this.cancelEdit();
          this.reloadAll();
        },
        error: (e) => this.erro.set(e.error?.error ?? 'Erro ao atualizar.'),
      });
    } else {
      this.api.create(body).subscribe({
        next: () => {
          this.msg.set('Produto criado.');
          this.resetForm();
          this.reloadAll();
        },
        error: (e) => this.erro.set(e.error?.error ?? 'Erro ao criar.'),
      });
    }
  }

  remove(p: Produto): void {
    if (!confirm(`Remover ${p.nome}?`)) return;
    this.api.delete(p.id).subscribe({
      next: () => {
        this.msg.set('Removido.');
        this.loadProdutos();
      },
      error: (e) => this.erro.set(e.error?.error ?? 'Erro ao remover.'),
    });
  }
}
