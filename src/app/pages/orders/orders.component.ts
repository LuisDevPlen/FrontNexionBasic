import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService, PedidoLista } from '../../core/order.service';
@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(OrderService);

  readonly pedidos = signal<PedidoLista[]>([]);
  readonly erro = signal<string | null>(null);

  ngOnInit(): void {
    this.api.list().subscribe({
      next: (p) => this.pedidos.set(p),
      error: () => this.erro.set('Erro ao carregar pedidos.'),
    });
  }

  fmt(v: string | number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  statusClass(s: string): string {
    if (s === 'aprovado') return 'ok';
    if (s === 'rejeitado') return 'bad';
    return 'pend';
  }

  labelForma(cod: string | null | undefined): string {
    const map: Record<string, string> = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };
    return cod && map[cod] ? map[cod] : '—';
  }

  truncateAddr(s: string | null | undefined, max = 42): string {
    if (!s) return '—';
    const t = s.trim();
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  }
}
