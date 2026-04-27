import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Evita que admin use rotas pensadas para o cliente (lista de pedidos própria). */
export const clientOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token()) return router.createUrlTree(['/login']);
  if (auth.isAdmin()) return router.createUrlTree(['/admin/pedidos']);
  return true;
};
