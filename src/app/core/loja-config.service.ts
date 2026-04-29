import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';

export interface LojaConfigDto {
  imprimir_pedido_automatico: boolean;
}

@Injectable({ providedIn: 'root' })
export class LojaConfigService {
  constructor(private readonly http: HttpClient) {}

  get(): Observable<LojaConfigDto> {
    return this.http.get<LojaConfigDto>(`${API_URL}/loja-config`);
  }

  patch(body: LojaConfigDto): Observable<LojaConfigDto> {
    return this.http.patch<LojaConfigDto>(`${API_URL}/loja-config`, body);
  }
}
