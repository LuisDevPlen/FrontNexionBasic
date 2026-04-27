import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';
import type { User } from './auth.service';

export interface UsuarioLista {
  id: number;
  nome: string;
  email: string;
  papel: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<UsuarioLista[]> {
    return this.http.get<UsuarioLista[]>(`${API_URL}/users`);
  }

  create(body: { nome: string; email: string; senha: string; papel: 'admin' | 'cliente' }): Observable<UsuarioLista> {
    return this.http.post<UsuarioLista>(`${API_URL}/users`, body);
  }

  setRole(id: number, papel: 'admin' | 'cliente'): Observable<User> {
    return this.http.patch<User>(`${API_URL}/users/${id}/role`, { papel });
  }
}
