import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { clientOnlyGuard } from './core/client.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'loja' },
  {
    path: 'loja',
    loadComponent: () => import('./pages/shop/shop.component').then((m) => m.ShopComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'cadastro',
    loadComponent: () => import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'carrinho',
    canActivate: [authGuard, clientOnlyGuard],
    loadComponent: () => import('./pages/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'meus-pedidos',
    canActivate: [authGuard, clientOnlyGuard],
    loadComponent: () => import('./pages/orders/orders.component').then((m) => m.OrdersComponent),
  },
  {
    path: 'admin/categorias',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-categories.component').then((m) => m.AdminCategoriesComponent),
  },
  {
    path: 'admin/adicionais',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-addons.component').then((m) => m.AdminAddonsComponent),
  },
  {
    path: 'admin/produtos',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-products.component').then((m) => m.AdminProductsComponent),
  },
  {
    path: 'admin/pedidos',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-orders.component').then((m) => m.AdminOrdersComponent),
  },
  {
    path: 'admin/usuarios',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-users.component').then((m) => m.AdminUsersComponent),
  },
  { path: '**', redirectTo: 'loja' },
];
