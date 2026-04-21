import Firewall from '@/components/pages/Firewall';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/firewall')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Firewall />;
}
