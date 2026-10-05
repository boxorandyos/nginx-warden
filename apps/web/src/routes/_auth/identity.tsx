import Authentication from '@/components/pages/Authentication'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/identity')({
  component: function IdentityRoute() {
    return <Authentication providersOnly />
  },
})
