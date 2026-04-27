import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';

export interface PedidoLista {
  id: number;
  usuario_id: number;
  status: string;
  total: string | number;
  created_at: string;
  usuario_nome?: string;
  usuario_email?: string;
  forma_pagamento?: string | null;
  endereco_entrega?: string | null;
}

export interface PedidoDetalhe extends PedidoLista {
  itens: {
    id: number;
    produto_id: number;
    quantidade: number;
    preco_unitario: string | number;
    produto_nome: string;
    opcao_adicionais?: string;
    extras_unitario?: string | number;
    /** Nomes/preços e quantidade por unidade do produto (pedido GET enriquecido) */
    adicionais?: {
      id: number;
      nome: string;
      preco: string | number;
      quantidade: number;
    }[];
  }[];
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<PedidoLista[]> {
    return this.http.get<PedidoLista[]>(`${API_URL}/orders`);
  }

  getOne(id: number): Observable<PedidoDetalhe> {
    return this.http.get<PedidoDetalhe>(`${API_URL}/orders/${id}`);
  }

  checkout(body: {
    forma_pagamento: 'dinheiro' | 'cartao' | 'pix';
    endereco_entrega: string;
  }): Observable<PedidoLista> {
    return this.http.post<PedidoLista>(`${API_URL}/orders/checkout`, body);
  }

  updateStatus(id: number, status: 'pendente' | 'aprovado' | 'rejeitado'): Observable<PedidoLista> {
    return this.http.patch<PedidoLista>(`${API_URL}/orders/${id}/status`, { status });
  }
}
