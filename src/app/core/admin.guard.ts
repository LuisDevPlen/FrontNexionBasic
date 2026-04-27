import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.token() && auth.isAdmin()) return true;
  if (!auth.token()) return router.createUrlTree(['/login']);
  return router.createUrlTree(['/loja']);
};
