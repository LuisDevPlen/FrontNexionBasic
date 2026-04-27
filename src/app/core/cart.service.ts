import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';

export interface AdicionalSelecionado {
  id: number;
  nome: string;
  preco: string | number;
  /** Quantidade por unidade do produto */
  quantidade?: number;
}

export interface CarrinhoItem {
  id: number;
  quantidade: number;
  produto_id: number;
  nome: string;
  /** Preço base só do produto */
  preco: string | number;
  descricao: string | null;
  categoria: string | null;
  imagem_url: string | null;
  extras_unitario?: number;
  /** Base + extras por unidade */
  preco_unitario_total?: number;
  adicionais_selecionados?: AdicionalSelecionado[];
}

export interface CarrinhoResponse {
  itens: CarrinhoItem[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  constructor(private readonly http: HttpClient) {}

  get(): Observable<CarrinhoResponse> {
    return this.http.get<CarrinhoResponse>(`${API_URL}/cart`);
  }

  add(
    produto_id: number,
    quantidade = 1,
    adicional_itens?: { adicional_id: number; quantidade: number }[]
  ): Observable<unknown> {
    const body: Record<string, unknown> = { produto_id, quantidade };
    if (adicional_itens !== undefined && adicional_itens.length > 0) {
      body['adicional_itens'] = adicional_itens;
    }
    return this.http.post(`${API_URL}/cart`, body);
  }

  updateItem(itemId: number, quantidade: number): Observable<unknown> {
    return this.http.put(`${API_URL}/cart/${itemId}`, { quantidade });
  }

  removeItem(itemId: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/cart/${itemId}`);
  }
}
