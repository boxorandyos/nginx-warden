import { ReactNode } from 'react';
import { AppTopBar } from './AppTopBar';
import { DashboardHeader } from './DashboardHeader';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}

export function DashboardLayout({ children, title, breadcrumbs }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppTopBar />
      <div className="app-canvas flex min-h-0 flex-1 flex-col border-x border-foreground/[0.06]">
        <DashboardHeader title={title} breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-auto px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
