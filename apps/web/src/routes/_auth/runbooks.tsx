import { RunbooksPage } from '@/components/pages/FleetShared'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/runbooks')({
  component: RunbooksPage,
})
