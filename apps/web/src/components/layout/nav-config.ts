import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Globe,
  Lock,
  Shield,
  UserCog,
  FileText,
  Bell,
  Activity,
  Network,
  Database,
  Users,
  Server,
  LayoutTemplate,
  Settings,
  Flame,
  KeyRound,
  Wrench,
  BookOpen,
  ScrollText,
  ShieldCheck,
  BarChart3,
  BellRing,
} from 'lucide-react';

/** Distinct section-based IA (not sidebar-style “groups”) */
export type NavLeaf = {
  path: string;
  navKey: string;
  icon: LucideIcon;
};

export type NavSection =
  | { kind: 'link'; id: string; path: string; navKey: string }
  | { kind: 'menu'; id: string; sectionKey: string; items: NavLeaf[] };

export const appNavSections: NavSection[] = [
  { kind: 'link', id: 'pulse', path: '/dashboard', navKey: 'nav.section.pulse' },
  {
    kind: 'menu',
    id: 'edge',
    sectionKey: 'nav.section.edge',
    items: [
      { path: '/domains', navKey: 'nav.domains', icon: Globe },
      { path: '/ssl', navKey: 'nav.ssl', icon: Lock },
      { path: '/network', navKey: 'nav.network', icon: Network },
      { path: '/default-server', navKey: 'nav.defaultServer', icon: LayoutTemplate },
    ],
  },
  {
    kind: 'menu',
    id: 'barrier',
    sectionKey: 'nav.section.barrier',
    items: [
      { path: '/modsecurity', navKey: 'nav.modsecurity', icon: Shield },
      { path: '/firewall', navKey: 'nav.firewall', icon: Flame },
      { path: '/acl', navKey: 'nav.acl', icon: UserCog },
      { path: '/access-lists', navKey: 'nav.access-lists', icon: Lock },
      { path: '/authentication', navKey: 'nav.authentication', icon: KeyRound },
    ],
  },
  {
    kind: 'menu',
    id: 'telemetry',
    sectionKey: 'nav.section.telemetry',
    items: [
      { path: '/logs', navKey: 'nav.logs', icon: FileText },
      { path: '/fleet-alerts', navKey: 'nav.alerts', icon: Bell },
      { path: '/alerts', navKey: 'nav.notifications', icon: BellRing },
      { path: '/performance', navKey: 'nav.performance', icon: Activity },
      { path: '/metrics', navKey: 'nav.metrics', icon: BarChart3 },
    ],
  },
  {
    kind: 'menu',
    id: 'control-plane',
    sectionKey: 'nav.section.control',
    items: [
      { path: '/users', navKey: 'nav.users', icon: Users },
      { path: '/service-accounts', navKey: 'nav.serviceAccounts', icon: Users },
      { path: '/identity', navKey: 'nav.identity', icon: KeyRound },
      { path: '/nodes', navKey: 'nav.nodes', icon: Server },
      { path: '/maintenance', navKey: 'nav.maintenance', icon: Wrench },
      { path: '/snapshots', navKey: 'nav.snapshots', icon: Database },
      { path: '/backup', navKey: 'nav.backup', icon: Database },
      { path: '/jobs', navKey: 'nav.jobs', icon: Activity },
      { path: '/runbooks', navKey: 'nav.runbooks', icon: BookOpen },
      { path: '/hardening', navKey: 'nav.hardening', icon: ShieldCheck },
      { path: '/audit', navKey: 'nav.audit', icon: ScrollText },
      { path: '/configuration', navKey: 'nav.configuration', icon: Settings },
      { path: '/platform', navKey: 'nav.platform', icon: Server },
    ],
  },
];
