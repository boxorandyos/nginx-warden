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
      { path: '/acl', navKey: 'nav.acl', icon: UserCog },
      { path: '/access-lists', navKey: 'nav.access-lists', icon: Lock },
    ],
  },
  {
    kind: 'menu',
    id: 'telemetry',
    sectionKey: 'nav.section.telemetry',
    items: [
      { path: '/logs', navKey: 'nav.logs', icon: FileText },
      { path: '/alerts', navKey: 'nav.alerts', icon: Bell },
      { path: '/performance', navKey: 'nav.performance', icon: Activity },
    ],
  },
  {
    kind: 'menu',
    id: 'control-plane',
    sectionKey: 'nav.section.control',
    items: [
      { path: '/backup', navKey: 'nav.backup', icon: Database },
      { path: '/users', navKey: 'nav.users', icon: Users },
      { path: '/nodes', navKey: 'nav.nodes', icon: Server },
      { path: '/configuration', navKey: 'nav.configuration', icon: Settings },
    ],
  },
];
