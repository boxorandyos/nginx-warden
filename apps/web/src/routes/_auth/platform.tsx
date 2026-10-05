import Platform from '@/components/pages/Platform'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/platform')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Platform />
}
