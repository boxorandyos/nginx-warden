import { createFileRoute } from '@tanstack/react-router';
import DefaultServer from '@/components/pages/DefaultServer';

export const Route = createFileRoute('/_auth/default-server')({
  component: RouteComponent,
});

function RouteComponent() {
  return <DefaultServer />;
}
