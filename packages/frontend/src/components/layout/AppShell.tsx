import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useTenant } from '@/hooks/useTenant';

export function AppShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  useTenant();

  return (
    <div className="relative flex h-screen overflow-hidden bg-bg-primary">
      <div aria-hidden className="app-backdrop" />
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />

      <div className="relative z-10 flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Mobile hamburger prepended inside the topbar area */}
        <div className="md:hidden absolute top-0 left-0 z-50 h-14 flex items-center pl-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 rounded text-text-muted hover:text-text-primary"
          >
            <Menu size={18} />
          </button>
        </div>

        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <ChangePasswordModal />
      <UpgradeModal />
    </div>
  );
}
