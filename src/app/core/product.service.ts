import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';

export interface AdicionalItem {
  id: number;
  nome: string;
  preco: string | number;
  descricao: string | null;
}

export interface Produto {
  id: number;
  nome: string;
  preco: string | number;
  descricao: string | null;
  categoria: string | null;
  categoria_id?: number | null;
  categoria_nome?: string | null;
  imagem_url: string | null;
  adicionais?: AdicionalItem[];
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<Produto[]> {
    return this.http.get<Produto[]>(`${API_URL}/products`);
  }

  create(
    body: Partial<Produto> & { adicional_ids?: number[] }
  ): Observable<Produto> {
    return this.http.post<Produto>(`${API_URL}/products`, body);
  }

  update(
    id: number,
    body: Partial<Produto> & { adicional_ids?: number[] }
  ): Observable<Produto> {
    return this.http.put<Produto>(`${API_URL}/products/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/products/${id}`);
  }
}
