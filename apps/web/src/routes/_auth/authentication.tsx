import { Authentication } from '@/components/pages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/authentication')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Authentication />
}
