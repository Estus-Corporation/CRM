import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage';
import { LandingPage } from '@/pages/landing/LandingPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ContactsPage } from '@/pages/contacts/ContactsPage';
import { ContactDetailPage } from '@/pages/contacts/ContactDetailPage';
import { PipelinePage } from '@/pages/pipeline/PipelinePage';
import { DealsListPage } from '@/pages/deals/DealsListPage';
import { DealDetailPage } from '@/pages/deals/DealDetailPage';
import { CalendarPage } from '@/pages/calendar/CalendarPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PrivacyPage, TermsPage } from '@/pages/legal/LegalPages';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/privacidade',
    element: <PrivacyPage />,
  },
  {
    path: '/termos',
    element: <TermsPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: '/onboarding',
    element: (
      <ProtectedRoute>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/pipeline', element: <PipelinePage /> },
      { path: '/pipeline/:pipelineId', element: <PipelinePage /> },
      { path: '/contacts', element: <ContactsPage /> },
      { path: '/contacts/:id', element: <ContactDetailPage /> },
      { path: '/deals', element: <DealsListPage /> },
      { path: '/deals/:id', element: <DealDetailPage /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
