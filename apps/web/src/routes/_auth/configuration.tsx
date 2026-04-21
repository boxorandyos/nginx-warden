import Configuration from '@/components/pages/Configuration';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/configuration')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Configuration />;
}
