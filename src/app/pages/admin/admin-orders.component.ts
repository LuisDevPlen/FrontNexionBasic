import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService, PedidoLista } from '../../core/order.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss',
})
export class AdminOrdersComponent implements OnInit {
  private readonly api = inject(OrderService);

  readonly pedidos = signal<PedidoLista[]>([]);
  readonly erro = signal<string | null>(null);
  readonly msg = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.erro.set(null);
    this.api.list().subscribe({
      next: (p) => this.pedidos.set(p),
      error: () => this.erro.set('Erro ao carregar pedidos.'),
    });
  }

  fmt(v: string | number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  labelForma(cod: string | null | undefined): string {
    const map: Record<string, string> = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };
    return cod && map[cod] ? map[cod] : '—';
  }

  truncateAddr(s: string | null | undefined, max = 48): string {
    if (!s) return '—';
    const t = s.trim();
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  }

  setStatus(id: number, status: 'aprovado' | 'rejeitado'): void {
    this.msg.set(null);
    this.busyId.set(id);
    this.api.updateStatus(id, status).subscribe({
      next: () => {
        this.busyId.set(null);
        this.msg.set('Status atualizado.');
        this.load();
      },
      error: (e) => {
        this.busyId.set(null);
        this.erro.set(e.error?.error ?? 'Erro ao atualizar.');
      },
    });
  }
}
