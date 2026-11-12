import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RpgShell } from '@/rpg/RpgShell';
import { Overview } from '@/rpg/pages/Overview';
import { Wishlist } from '@/rpg/pages/Wishlist';
import { UniversePage } from '@/rpg/pages/Universes';
import { Settings } from '@/rpg/pages/pages';

// Branch rpg-life: o frontend é o Life RPG (as telas do CRM continuam no código, mas sem rota)
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RpgShell />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'universos/:key', element: <UniversePage /> },
      { path: 'wishlist', element: <Wishlist /> },
      { path: 'config', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
