import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';

export interface Categoria {
  id: number;
  nome: string;
}

export interface Adicional {
  id: number;
  nome: string;
  preco: string | number;
  descricao: string | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private readonly http: HttpClient) {}

  listCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${API_URL}/categorias`);
  }

  createCategoria(nome: string): Observable<Categoria> {
    return this.http.post<Categoria>(`${API_URL}/categorias`, { nome });
  }

  updateCategoria(id: number, nome: string): Observable<Categoria> {
    return this.http.put<Categoria>(`${API_URL}/categorias/${id}`, { nome });
  }

  deleteCategoria(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/categorias/${id}`);
  }

  listAdicionais(): Observable<Adicional[]> {
    return this.http.get<Adicional[]>(`${API_URL}/adicionais`);
  }

  createAdicional(body: {
    nome: string;
    preco?: number;
    descricao?: string | null;
  }): Observable<Adicional> {
    return this.http.post<Adicional>(`${API_URL}/adicionais`, body);
  }

  updateAdicional(
    id: number,
    body: { nome: string; preco?: number; descricao?: string | null }
  ): Observable<Adicional> {
    return this.http.put<Adicional>(`${API_URL}/adicionais/${id}`, body);
  }

  deleteAdicional(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/adicionais/${id}`);
  }
}
