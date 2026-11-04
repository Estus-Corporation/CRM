import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RpgShell } from '@/rpg/RpgShell';
import { Overview } from '@/rpg/pages/Overview';
import { Missions } from '@/rpg/pages/Missions';
import { Achievements, Areas, Goals, History, SelfCare, Settings } from '@/rpg/pages/pages';

// Branch rpg-life: o frontend é o Life RPG (as telas do CRM continuam no código, mas sem rota)
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RpgShell />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'areas', element: <Areas /> },
      { path: 'autocuidado', element: <SelfCare /> },
      { path: 'metas', element: <Goals /> },
      { path: 'missoes', element: <Missions /> },
      { path: 'conquistas', element: <Achievements /> },
      { path: 'historico', element: <History /> },
      { path: 'config', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
