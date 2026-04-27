import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { CartService, CarrinhoItem } from '../../core/cart.service';
import { OrderService, PedidoDetalhe, PedidoLista } from '../../core/order.service';
import { AuthService } from '../../core/auth.service';
import { WHATSAPP_PEDIDO_NUMERO } from '../../core/api.config';

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
    this.orders
      .checkout({ forma_pagamento: fp, endereco_entrega: addr })
      .pipe(
        switchMap((pedido) =>
          this.orders.getOne(pedido.id).pipe(
            map((detail) => ({ pedido, detail })),
            catchError(() => of({ pedido, detail: null as PedidoDetalhe | null }))
          )
        )
      )
      .subscribe({
        next: ({ pedido, detail }) => {
          this.checkoutLoading.set(false);
          const texto = this.montarMensagemWhatsapp(pedido, detail);
          const url = `https://wa.me/${WHATSAPP_PEDIDO_NUMERO}?text=${encodeURIComponent(texto)}`;
          window.open(url, '_blank', 'noopener,noreferrer');
          this.msg.set('Pedido criado. Envie a mensagem no WhatsApp que abriu em nova aba.');
          this.refresh();
        },
        error: (e) => {
          this.checkoutLoading.set(false);
          this.erro.set(e.error?.error ?? 'Erro ao finalizar.');
        },
      });
  }

  private montarMensagemWhatsapp(pedido: PedidoLista, detail: PedidoDetalhe | null): string {
    const totalFmt = Number(detail?.total ?? pedido.total).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const formaLabel = this.labelFormaPagamento(detail?.forma_pagamento ?? pedido.forma_pagamento);
    const endereco =
      detail?.endereco_entrega ?? pedido.endereco_entrega ?? '';

    const linhas: string[] = [
      'Olá! Acabei de finalizar um pedido pelo site.',
      '',
      `Pedido #${detail?.id ?? pedido.id}`,
      `Total: ${totalFmt}`,
      `Status: ${detail?.status ?? pedido.status}`,
      `Forma de pagamento: ${formaLabel}`,
      `Endereço de entrega: ${endereco}`,
    ];
    const itens = detail?.itens;
    if (itens?.length) {
      linhas.push('', 'Itens:');
      for (const i of itens) {
        const base = Number(i.preco_unitario);
        const ex = Number(i.extras_unitario ?? 0);
        const unit = base + ex;
        const sub = unit * i.quantidade;
        const subFmt = sub.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        linhas.push(`• ${i.produto_nome}`);
        linhas.push(`  Quantidade: ${i.quantidade}`);
        linhas.push(`  Subtotal: ${subFmt}`);
        if (i.adicionais?.length) {
          linhas.push(
            `  Adicionais: ${i.adicionais
              .map((a) => `${a.nome} ×${a.quantidade ?? 1}`)
              .join('; ')}`
          );
        } else if (ex > 0) {
          linhas.push(`  Adicionais: extras R$ ${this.fmt(ex)} por unidade`);
        }
      }
    }
    return linhas.join('\n');
  }

  private labelFormaPagamento(cod: string | null | undefined): string {
    const map: Record<string, string> = {
      dinheiro: 'Dinheiro',
      cartao: 'Cartão',
      pix: 'PIX',
    };
    return cod && map[cod] ? map[cod] : cod ?? '—';
  }
}
