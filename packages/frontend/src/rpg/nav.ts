import { Home, Gift, type LucideIcon } from 'lucide-react';
import { type UniverseKey, universeOf } from './data';

export interface NavItem {
  id: string;
  to: string;
  label: string;
  /** Rótulo curto da barra do celular */
  short?: string;
  icon: LucideIcon;
  /** Está nesta página? (pathname + search) */
  match: (pathname: string, search: string) => boolean;
}

export interface NavSection {
  id: string;
  /** Vazio = sem título (bloco do topo) */
  label: string;
  /** Pode recolher no menu lateral */
  collapsible?: boolean;
  items: NavItem[];
}

const universe = (key: UniverseKey, extra?: Partial<NavItem>): NavItem => {
  const u = universeOf(key);
  return { id: key, to: `/universos/${key}`, label: u.label, icon: u.icon, match: (p) => p === `/universos/${key}`, ...extra };
};

/**
 * Menu do Life RPG, em blocos:
 * Início · Dinheiro (Financeiro + Wishlist) · e os outros universos divididos em Você / Vida.
 * Os gastos ficam dentro do Financeiro, na lista junto de Fontes de renda, Investimentos etc.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'start',
    label: '',
    items: [
      { id: 'home', to: '/', label: 'Visão geral', short: 'Início', icon: Home, match: (p) => p === '/' },
    ],
  },
  {
    id: 'money',
    label: 'Dinheiro',
    items: [
      universe('finance', { short: 'Financeiro' }),
      { id: 'wishlist', to: '/wishlist', label: 'Wishlist', icon: Gift, match: (p) => p === '/wishlist' },
    ],
  },
  {
    id: 'self',
    label: 'Você',
    collapsible: true,
    items: [universe('selfcare'), universe('health'), universe('growth'), universe('career')],
  },
  {
    id: 'life',
    label: 'Vida',
    collapsible: true,
    items: [universe('relations'), universe('leisure'), universe('home'), universe('purpose')],
  },
];
