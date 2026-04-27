import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';

export interface User {
  id: number;
  nome: string;
  email: string;
  papel: 'admin' | 'cliente';
  /** Endereço salvo para entrega (editável no carrinho ou via API) */
  endereco_entrega?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'nexion_token';
  private readonly userKey = 'nexion_user';

  readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(null);
  readonly isAdmin = computed(() => this.user()?.papel === 'admin');

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    this.restore();
  }

  private restore(): void {
    const t = localStorage.getItem(this.storageKey);
    const u = localStorage.getItem(this.userKey);
    if (t) this.token.set(t);
    if (u) {
      try {
        this.user.set(JSON.parse(u) as User);
      } catch {
        localStorage.removeItem(this.userKey);
      }
    }
  }

  persist(token: string, user: User): void {
    this.token.set(token);
    this.user.set(user);
    localStorage.setItem(this.storageKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  login(email: string, senha: string) {
    return this.http
      .post<{ user: User; token: string }>(`${API_URL}/auth/login`, { email, senha })
      .pipe(tap((res) => this.persist(res.token, res.user)));
  }

  register(nome: string, email: string, senha: string) {
    return this.http
      .post<{ user: User; token: string }>(`${API_URL}/auth/register`, { nome, email, senha })
      .pipe(tap((res) => this.persist(res.token, res.user)));
  }

  /** Perfil atualizado no servidor (inclui endereco_entrega) */
  getProfile(): Observable<User> {
    return this.http.get<User>(`${API_URL}/auth/me`).pipe(
      tap((u) => {
        const t = this.token();
        if (t) this.persist(t, u);
      })
    );
  }

  /** Salva só o endereço de entrega no perfil */
  updateEnderecoEntrega(endereco_entrega: string): Observable<User> {
    return this.http
      .put<User>(`${API_URL}/auth/profile`, { endereco_entrega })
      .pipe(
        tap((u) => {
          const t = this.token();
          if (t) this.persist(t, u);
        })
      );
  }

  logout(): void {
    this.token.set(null);
    this.user.set(null);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.userKey);
    void this.router.navigate(['/login']);
  }
}
