import { FleetAlertsPage } from '@/components/pages/FleetShared'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/fleet-alerts')({
  component: FleetAlertsPage,
})
