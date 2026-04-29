import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService, CarrinhoItem } from '../../core/cart.service';
import { OrderService } from '../../core/order.service';
import { AuthService } from '../../core/auth.service';

type FormaPagamento = 'dinheiro' | 'cartao' | 'pix';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent implements OnInit {
  private readonly cartApi = inject(CartService);
  private readonly orders = inject(OrderService);
  private readonly auth = inject(AuthService);

  readonly itens = signal<CarrinhoItem[]>([]);
  readonly total = signal(0);
  readonly erro = signal<string | null>(null);
  readonly msg = signal<string | null>(null);
  readonly checkoutLoading = signal(false);
  readonly enderecoEntrega = signal('');
  readonly formaPagamento = signal<FormaPagamento | ''>('');
  readonly profileSaving = signal(false);
  readonly profileMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.refresh();
    this.auth.getProfile().subscribe({
      next: (u) => this.enderecoEntrega.set(u.endereco_entrega ?? ''),
      error: () => {},
    });
  }

  refresh(): void {
    this.erro.set(null);
    this.cartApi.get().subscribe({
      next: (r) => {
        this.itens.set(r.itens);
        this.total.set(r.total);
      },
      error: () => this.erro.set('Erro ao carregar carrinho.'),
    });
  }

  setForma(f: FormaPagamento): void {
    this.formaPagamento.set(f);
  }

  salvarEnderecoPerfil(): void {
    this.profileMsg.set(null);
    this.erro.set(null);
    this.profileSaving.set(true);
    this.auth.updateEnderecoEntrega(this.enderecoEntrega()).subscribe({
      next: () => {
        this.profileSaving.set(false);
        this.profileMsg.set('Endereço salvo para próximas entregas.');
      },
      error: () => {
        this.profileSaving.set(false);
        this.erro.set('Erro ao salvar endereço.');
      },
    });
  }

  fmt(v: string | number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  subtotal(i: CarrinhoItem): string {
    const unit =
      i.preco_unitario_total != null ? Number(i.preco_unitario_total) : Number(i.preco);
    return this.fmt(unit * i.quantidade);
  }

  updateQty(i: CarrinhoItem, q: number | string): void {
    const n = typeof q === 'string' ? parseInt(q, 10) : q;
    if (!Number.isFinite(n) || n < 1) return;
    this.cartApi.updateItem(i.id, n).subscribe({
      next: () => this.refresh(),
      error: () => this.erro.set('Erro ao atualizar quantidade.'),
    });
  }

  remove(i: CarrinhoItem): void {
    this.cartApi.removeItem(i.id).subscribe({
      next: () => this.refresh(),
      error: () => this.erro.set('Erro ao remover.'),
    });
  }

  checkout(): void {
    this.msg.set(null);
    this.erro.set(null);
    const fp = this.formaPagamento();
    if (!fp) {
      this.erro.set('Escolha a forma de pagamento.');
      return;
    }
    const addr = this.enderecoEntrega().trim();
    if (addr.length < 8) {
      this.erro.set('Informe o endereço completo para entrega (rua, número, bairro, cidade…).');
      return;
    }
    this.checkoutLoading.set(true);
    this.orders.checkout({ forma_pagamento: fp, endereco_entrega: addr }).subscribe({
      next: (pedido) => {
        this.checkoutLoading.set(false);
        this.msg.set(
          `Pedido #${pedido.id} registrado. A loja recebe notificação por e-mail. Você pode acompanhar em “Meus pedidos”.`
        );
        this.refresh();
      },
      error: (e) => {
        this.checkoutLoading.set(false);
        this.erro.set(e.error?.error ?? 'Erro ao finalizar.');
      },
    });
  }
}
