import { MetricsPage } from '@/components/pages/FleetShared'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/metrics')({
  component: MetricsPage,
})
