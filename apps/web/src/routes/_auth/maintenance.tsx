import Maintenance from '@/components/pages/Maintenance'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/maintenance')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Maintenance />
}
