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
  readonly imagemLendo = signal(false);

  /** JPEG/PNG/WebP da câmara — comprimir no browser; limite do ficheiro antes de processar */
  private readonly maxBytesArquivo = 12_000_000;
  /** GIF sem recompressão — mantém-se pequeno */
  private readonly maxBytesGif = 800_000;

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

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  /** Reduz pixels e JPEG para o payload caber na API (base64 ~33% maior que o binário). */
  private async optimizeImageToDataUrl(file: File): Promise<string> {
    if (file.type === 'image/gif') {
      if (file.size > this.maxBytesGif) {
        throw new Error('GIF muito grande (máx. 800 KB).');
      }
      return this.readFileAsDataURL(file);
    }

    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(file);
    } catch {
      if (file.size > 2_500_000) {
        throw new Error(
          'Não foi possível comprimir esta imagem automaticamente. Use uma foto menor ou formato JPEG.'
        );
      }
      return this.readFileAsDataURL(file);
    }
    try {
      /** ~900 px costuma gerar data URL bem abaixo de 1 MB para o JSON */
      const maxSide = 900;
      let w = bmp.width;
      let h = bmp.height;
      const factor = Math.min(1, maxSide / Math.max(w, h));
      w = Math.round(w * factor);
      h = Math.round(h * factor);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Não foi possível processar a imagem.');
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);

      let quality = 0.76;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 550_000 && quality > 0.42) {
        quality -= 0.06;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      if (dataUrl.length > 900_000) {
        throw new Error(
          'Mesmo após comprimir, a imagem ficou grande demais. Experimente uma foto mais simples ou menor.'
        );
      }
      return dataUrl;
    } finally {
      bmp.close();
    }
  }

  async onImageFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      this.erro.set('Use apenas JPEG, PNG, WebP ou GIF.');
      return;
    }
    if (file.type !== 'image/gif' && file.size > this.maxBytesArquivo) {
      this.erro.set('Arquivo muito grande (máx. 12 MB antes de otimizar). Escolha outra foto.');
      return;
    }

    this.erro.set(null);
    this.msg.set(null);
    this.imagemLendo.set(true);
    try {
      this.imagem_url = await this.optimizeImageToDataUrl(file);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Erro ao processar a imagem. Tente outro formato ou foto menor.';
      this.erro.set(msg);
    } finally {
      this.imagemLendo.set(false);
    }
  }

  clearImage(): void {
    this.imagem_url = '';
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
