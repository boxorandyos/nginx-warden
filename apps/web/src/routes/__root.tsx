import { createRootRouteWithContext, Outlet, useRouteContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider, QueryErrorResetBoundary } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'
import { ThemeProvider } from 'next-themes'
import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'
import '@/index.css'

// Define the router context type
interface RouterContext {
  auth: {
    isAuthenticated: boolean
    currentUser: any
  }
  queryClient: QueryClient
}

function RootComponent() {
  const { queryClient } = useRouteContext({ from: '__root__' });
  const { t } = useTranslation();

  return (
    <NuqsAdapter>
      <QueryClientProvider client={queryClient}>
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <TooltipProvider>
                <Toaster />
                <div className="min-h-screen bg-background">
                  <Suspense fallback={<div className="flex items-center justify-center min-h-screen">{t('app.loading')}</div>}>
                    <Outlet />
                  </Suspense>
                </div>
                <TanStackRouterDevtools />
              </TooltipProvider>
            </ThemeProvider>
          )}
        </QueryErrorResetBoundary>
      </QueryClientProvider>
    </NuqsAdapter>
  );
}

function RootError({ error }: { error: Error }) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background">
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">{t('app.error.title')}</h2>
      <pre className="bg-muted text-muted-foreground text-sm p-4 rounded-lg border mb-6 overflow-auto max-w-lg w-full font-mono">
        {message}
      </pre>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        {t('app.error.reload')}
      </button>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: RootError,
})
