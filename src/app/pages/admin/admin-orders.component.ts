import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap, timer } from 'rxjs';
import { OrderService, PedidoDetalhe, PedidoLista } from '../../core/order.service';
import { LojaConfigDto, LojaConfigService } from '../../core/loja-config.service';

type LojaConfigLoaded = LojaConfigDto & { apiOk: boolean };

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss',
})
export class AdminOrdersComponent implements OnInit {
  private readonly api = inject(OrderService);
  private readonly lojaConfig = inject(LojaConfigService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pedidos = signal<PedidoLista[]>([]);
  readonly erro = signal<string | null>(null);
  readonly msg = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);
  readonly printTicket = signal<PedidoDetalhe | null>(null);
  readonly printBusyId = signal<number | null>(null);
  /** Espelha `loja_config.imprimir_pedido_automatico` na base. */
  readonly imprimirPedidoAutomatico = signal(false);
  readonly configSaving = signal(false);
  /** False quando GET /loja-config falha (ex.: API em produção desatualizada). */
  readonly lojaConfigApiOk = signal(true);
  /** IDs de pedidos novos ainda pendentes — alerta e bip até aprovar ou rejeitar. */
  readonly alertaNovosPedidos = signal<number[]>([]);

  /** Pedidos que entraram como “novos” e ainda exigem ação (som repetido enquanto status === pendente). */
  private readonly pendingAlertIds = new Set<number>();

  private autoPrintWatermark = 0;
  private autoPrintQueue: number[] = [];
  private autoPrintDraining = false;
  /** Maior ID de pedido já visto — acima disto = pedido novo (alerta sonoro). */
  private lastSeenMaxOrderId = 0;
  /** Um único contexto — fallback se o WAV falhar. */
  private audioCtx: AudioContext | null = null;
  /** Som em ficheiro (public/sounds) — mais fiável que só oscilador. */
  private alertAudio: HTMLAudioElement | null = null;

  ngOnInit(): void {
    const config$: Observable<LojaConfigLoaded> = this.lojaConfig.get().pipe(
      map((c) => ({ ...c, apiOk: true })),
      catchError(() => of({ imprimir_pedido_automatico: false, apiOk: false }))
    );

    forkJoin({
      pedidos: this.api.list(),
      config: config$,
    }).subscribe({
      next: ({ pedidos: list, config }) => {
        this.lojaConfigApiOk.set(config.apiOk);
        this.pedidos.set(list);
        this.imprimirPedidoAutomatico.set(config.imprimir_pedido_automatico);
        const maxId = list.length ? Math.max(...list.map((p) => p.id)) : 0;
        this.lastSeenMaxOrderId = maxId;
        if (config.imprimir_pedido_automatico) {
          this.autoPrintWatermark = maxId;
        }
        this.setupOrdersPoll();
      },
      error: () => this.erro.set('Erro ao carregar pedidos.'),
    });
  }

  /** Primeira verificação rápida, depois a cada 3 s — atualiza a tabela e dispara som se houver pedido novo. */
  private setupOrdersPoll(): void {
    timer(800, 3000)
      .pipe(takeUntilDestroyed(this.destroyRef), switchMap(() => this.api.list()))
      .subscribe({
        next: (list) => this.handlePollResult(list),
        error: () => {},
      });
  }

  /** Desbloqueia áudio (Web Audio + elemento HTMLAudio). */
  @HostListener('document:pointerdown')
  @HostListener('document:keydown')
  unlockAudioFromUserGesture(): void {
    const ctx = this.ensureAudioContext();
    void ctx?.resume();
    try {
      const a = this.getAlertAudio();
      const v = a.volume;
      a.volume = 0.01;
      void a.play().then(() => {
        a.pause();
        a.currentTime = 0;
        a.volume = v;
      }).catch(() => {
        a.volume = v;
      });
    } catch {
      /* ignorar */
    }
  }

  private getAlertAudio(): HTMLAudioElement {
    if (!this.alertAudio) {
      this.alertAudio = new Audio('/sounds/order-beep.wav');
      this.alertAudio.preload = 'auto';
    }
    return this.alertAudio;
  }

  private ensureAudioContext(): AudioContext | null {
    try {
      type WinAudio = Window & { webkitAudioContext?: typeof AudioContext };
      const AC = window.AudioContext ?? (window as WinAudio).webkitAudioContext;
      if (!AC) return null;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AC();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /** Para testar o volume no PC da loja (clique = já desbloqueia o áudio). */
  testarSomPedido(): void {
    this.playNewOrderSound();
  }

  private handlePollResult(list: PedidoLista[]): void {
    const prevMax = this.lastSeenMaxOrderId;
    const maxId = list.length ? Math.max(...list.map((p) => p.id)) : 0;
    const novos = list.filter((p) => p.id > prevMax).map((p) => p.id);

    this.pedidos.set([...list]);

    if (novos.length > 0) {
      this.lastSeenMaxOrderId = maxId;
      for (const id of novos) this.pendingAlertIds.add(id);
    }

    this.syncPendingAlertsFromList(list);

    if (this.pendingAlertIds.size > 0) {
      this.playNewOrderSound();
    }

    this.cdr.detectChanges();

    if (!this.imprimirPedidoAutomatico()) return;

    const newIds = list
      .map((p) => p.id)
      .filter((id) => id > this.autoPrintWatermark)
      .sort((a, b) => a - b);
    for (const id of newIds) {
      if (!this.autoPrintQueue.includes(id)) this.autoPrintQueue.push(id);
    }
    this.drainAutoPrint();
  }

  /** Remove da fila de alerta pedidos já aprovados, rejeitados ou ausentes; atualiza o banner. */
  private syncPendingAlertsFromList(list: PedidoLista[]): void {
    for (const id of [...this.pendingAlertIds]) {
      const row = list.find((p) => p.id === id);
      if (!row || row.status !== 'pendente') {
        this.pendingAlertIds.delete(id);
      }
    }
    this.alertaNovosPedidos.set([...this.pendingAlertIds].sort((a, b) => a - b));
  }

  /** WAV em /sounds (fiável); fallback Web Audio. */
  private playNewOrderSound(): void {
    const a = this.getAlertAudio();
    a.volume = 1;
    a.currentTime = 0;
    void a
      .play()
      .then(() => {
        window.setTimeout(() => {
          a.currentTime = 0;
          void a.play().catch(() => this.playWebAudioFallback());
        }, 320);
      })
      .catch(() => this.playWebAudioFallback());
  }

  private playWebAudioFallback(): void {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const play = () => {
      const beep = (freq: number, delaySec: number, durSec: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'square';
        o.frequency.value = freq;
        const t0 = ctx.currentTime + delaySec;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.28, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
        o.start(t0);
        o.stop(t0 + durSec + 0.05);
      };
      beep(880, 0, 0.22);
      beep(1174, 0.24, 0.24);
    };
    void ctx.resume().then(play).catch(() => {
      try {
        play();
      } catch {
        /* bloqueado */
      }
    });
  }

  load(): void {
    this.erro.set(null);
    this.api.list().subscribe({
      next: (p) => {
        this.pedidos.set([...p]);
        const maxId = p.length ? Math.max(...p.map((x) => x.id)) : 0;
        if (maxId > this.lastSeenMaxOrderId) this.lastSeenMaxOrderId = maxId;
        this.syncPendingAlertsFromList(p);
        this.cdr.detectChanges();
      },
      error: () => this.erro.set('Erro ao carregar pedidos.'),
    });
  }

  onImprimirAutomaticoToggle(checked: boolean): void {
    if (!this.lojaConfigApiOk()) return;
    this.erro.set(null);
    this.configSaving.set(true);
    this.lojaConfig.patch({ imprimir_pedido_automatico: checked }).subscribe({
      next: (cfg) => {
        this.configSaving.set(false);
        this.imprimirPedidoAutomatico.set(cfg.imprimir_pedido_automatico);
        if (cfg.imprimir_pedido_automatico) {
          const p = this.pedidos();
          this.autoPrintWatermark = p.length ? Math.max(...p.map((x) => x.id)) : 0;
          this.autoPrintQueue = [];
          this.autoPrintDraining = false;
          this.pollAndQueueNewPedidos();
        } else {
          this.autoPrintQueue = [];
          this.autoPrintDraining = false;
        }
        this.msg.set(
          cfg.imprimir_pedido_automatico
            ? 'Impressão automática ativada. Mantenha esta página aberta no PC da loja.'
            : 'Impressão automática desativada.'
        );
      },
      error: (e) => {
        this.configSaving.set(false);
        this.erro.set(e.error?.error ?? 'Erro ao gravar opção.');
      },
    });
  }

  private pollAndQueueNewPedidos(): void {
    if (!this.imprimirPedidoAutomatico()) return;
    this.api.list().subscribe({
      next: (list) => this.handlePollResult(list),
      error: () => {},
    });
  }

  private drainAutoPrint(): void {
    if (!this.imprimirPedidoAutomatico() || this.autoPrintDraining || this.autoPrintQueue.length === 0) {
      return;
    }
    this.autoPrintDraining = true;
    const id = this.autoPrintQueue[0];
    this.printPedido(id, {
      onPrintClosed: () => {
        this.autoPrintDraining = false;
        if (this.autoPrintQueue[0] === id) this.autoPrintQueue.shift();
        if (id > this.autoPrintWatermark) this.autoPrintWatermark = id;
        this.drainAutoPrint();
      },
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

  printPedido(id: number, opts?: { onPrintClosed?: () => void }): void {
    this.erro.set(null);
    this.printBusyId.set(id);
    this.api.getOne(id).subscribe({
      next: (detail) => {
        this.printBusyId.set(null);
        this.printTicket.set(detail);
        requestAnimationFrame(() => {
          setTimeout(() => window.print(), 0);
        });
        let closed = false;
        const finish = () => {
          if (closed) return;
          closed = true;
          this.printTicket.set(null);
          opts?.onPrintClosed?.();
        };
        window.addEventListener('afterprint', finish, { once: true });
        setTimeout(finish, 3000);
      },
      error: () => {
        this.printBusyId.set(null);
        this.erro.set('Erro ao carregar pedido para impressão.');
        opts?.onPrintClosed?.();
      },
    });
  }

  itemSubtotalFmt(item: PedidoDetalhe['itens'][0]): string {
    const base = Number(item.preco_unitario);
    const ex = Number(item.extras_unitario ?? 0);
    return this.fmt((base + ex) * item.quantidade);
  }

  adicionalSubtotalFmt(
    item: PedidoDetalhe['itens'][0],
    ad: { preco: string | number; quantidade: number }
  ): string {
    return this.fmt(Number(ad.preco) * ad.quantidade * item.quantidade);
  }

  subtotalExtrasAgregados(item: PedidoDetalhe['itens'][0]): string | null {
    const ex = Number(item.extras_unitario ?? 0);
    if (ex <= 0) return null;
    if (item.adicionais?.length) return null;
    return this.fmt(ex * item.quantidade);
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
