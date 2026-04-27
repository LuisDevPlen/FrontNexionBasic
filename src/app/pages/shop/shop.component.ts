import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService, Produto } from '../../core/product.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';

interface GrupoCategoria {
  nome: string;
  anchorId: string;
  titleId: string;
  produtos: Produto[];
}

function slugCategoria(nome: string): string {
  const s = nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'geral';
}

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss',
})
export class ShopComponent implements OnInit {
  private readonly products = inject(ProductService);
  private readonly cart = inject(CartService);
  readonly auth = inject(AuthService);

  readonly lista = signal<Produto[]>([]);
  readonly erro = signal<string | null>(null);
  readonly msg = signal<string | null>(null);

  /** Produtos agrupados por categoria (fileiras), ordenados pelo nome da categoria */
  readonly grupos = computed((): GrupoCategoria[] => {
    const map = new Map<string, GrupoCategoria>();
    for (const p of this.lista()) {
      const nome = (p.categoria_nome ?? p.categoria ?? 'Geral').trim() || 'Geral';
      const key = p.categoria_id != null ? `id:${p.categoria_id}` : `nome:${nome.toLowerCase()}`;
      const anchorId =
        p.categoria_id != null ? `categoria-${p.categoria_id}` : `categoria-${slugCategoria(nome)}`;
      let g = map.get(key);
      if (!g) {
        const titleId = `${anchorId}-titulo`;
        g = { nome, anchorId, titleId, produtos: [] };
        map.set(key, g);
      }
      g.produtos.push(p);
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });

  readonly modalProduto = signal<Produto | null>(null);
  /** Por unidade de produto: id do adicional → quantidade (0 = não incluir) */
  readonly adicionalQtd = signal<Record<number, number>>({});
  readonly modalQtd = signal(1);

  ngOnInit(): void {
    this.products.list().subscribe({
      next: (p) => this.lista.set(p),
      error: () => this.erro.set('Não foi possível carregar os produtos.'),
    });
  }

  irParaCategoria(anchorId: string): void {
    requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  abrirProduto(p: Produto): void {
    this.msg.set(null);
    this.modalProduto.set(p);
    this.adicionalQtd.set({});
    this.modalQtd.set(1);
  }

  fecharModal(): void {
    this.modalProduto.set(null);
  }

  qtdAdicional(id: number): number {
    return this.adicionalQtd()[id] ?? 0;
  }

  onAdicionalQtd(id: number, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    let v = parseInt(el.value, 10);
    if (!Number.isFinite(v)) v = 0;
    v = Math.min(999, Math.max(0, Math.floor(v)));
    const cur = { ...this.adicionalQtd() };
    if (v <= 0) {
      delete cur[id];
    } else {
      cur[id] = v;
    }
    this.adicionalQtd.set(cur);
    el.value = String(v);
  }

  onModalQtdInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const n = parseInt(el.value, 10);
    const q = Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 9999) : 1;
    this.modalQtd.set(q);
    el.value = String(q);
  }

  preco(p: Produto): string {
    return Number(p.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  precoAdicional(a: { preco: string | number }): string {
    return Number(a.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** Total no modal = qtd produtos × (base + Σ preço adicional × qtd adicional por unidade) */
  totalModal(): string {
    const p = this.modalProduto();
    if (!p) return '';
    let unit = Number(p.preco);
    const qtdPorAd = this.adicionalQtd();
    for (const a of p.adicionais ?? []) {
      const q = qtdPorAd[a.id] ?? 0;
      if (q > 0) unit += Number(a.preco) * q;
    }
    const total = unit * this.modalQtd();
    return total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  confirmarAoCarrinho(): void {
    const p = this.modalProduto();
    if (!p) return;

    this.msg.set(null);
    if (!this.auth.token()) {
      this.msg.set('Faça login para adicionar ao carrinho.');
      return;
    }

    const map = this.adicionalQtd();
    const adicional_itens = Object.entries(map)
      .map(([id, quantidade]) => ({
        adicional_id: parseInt(id, 10),
        quantidade,
      }))
      .filter((x) => Number.isFinite(x.adicional_id) && x.quantidade > 0);

    const q = this.modalQtd();
    this.cart.add(p.id, q, adicional_itens.length ? adicional_itens : undefined).subscribe({
      next: () => {
        this.msg.set(
          q > 1 ? `${q}× ${p.nome} adicionado ao carrinho.` : `${p.nome} adicionado ao carrinho.`
        );
        this.fecharModal();
      },
      error: (e) => this.msg.set(e.error?.error ?? 'Erro ao adicionar.'),
    });
  }
}
