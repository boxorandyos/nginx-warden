import { useTranslation } from "react-i18next";
import { Fragment, Suspense, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Globe,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Shield,
  TrendingUp,
  Clock,
  Users,
  Eye,
  ArrowRight,
  Sparkles,
  FileText,
  Lock,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  useSuspenseDashboardStats,
  useSuspenseRequestTrend,
  useSuspenseSlowRequests,
  useSuspenseLatestAttackStats,
  useSuspenseLatestNews,
  useSuspenseRequestAnalytics,
  useSuspenseAttackRatio,
} from "@/queries";
import { SkeletonStatsCard, SkeletonChart, SkeletonTable } from "@/components/ui/skeletons";
import { cn } from "@/lib/utils";

const PANEL =
  "relative overflow-hidden rounded-none border border-foreground/10 bg-card/85 shadow-[0_1px_0_0_hsl(var(--foreground)/0.05)] backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg hover:shadow-black/[0.06] dark:bg-card/70";

const STATUS_CODES_CONFIG = [
  { key: "status200", color: "#22c55e", label: "dashboard.status200" },
  { key: "status301", color: "#3b82f6", label: "dashboard.status301" },
  { key: "status302", color: "#06b6d4", label: "dashboard.status302" },
  { key: "status400", color: "#f59e0b", label: "dashboard.status400" },
  { key: "status403", color: "#f97316", label: "dashboard.status403" },
  { key: "status404", color: "#eab308", label: "dashboard.status404" },
  { key: "status500", color: "#ef4444", label: "dashboard.status500" },
  { key: "status502", color: "#dc2626", label: "dashboard.status502" },
  { key: "status503", color: "#b91c1c", label: "dashboard.status503" },
] as const;

const formatTime = (date: Date) =>
  `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;

const getAttackPercentageColor = (percentage: number) => {
  if (percentage > 10) return "text-destructive";
  if (percentage > 5) return "text-warning";
  return "text-success";
};

const getSeverityVariant = (severity: string): "destructive" | "default" => {
  return severity === "CRITICAL" || severity === "2" ? "destructive" : "default";
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
    <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

const CountBadge = ({
  count,
  variant = "destructive",
}: {
  count: number;
  variant?: "destructive" | "secondary";
}) =>
  count > 0 ? (
    <Badge variant={variant}>{count}</Badge>
  ) : (
    <span className="text-muted-foreground">0</span>
  );

const ListItem = ({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 border-l-2 border-primary/40 bg-secondary/40 py-2.5 pl-3 pr-2 transition-colors hover:bg-secondary/60">
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
    {badge}
  </div>
);

const CardHeaderWithIcon = ({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) => (
  <CardHeader className="border-b border-border/60 pb-4">
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-foreground/10 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 space-y-1">
        <CardTitle className="text-base font-semibold leading-tight">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </div>
    </div>
  </CardHeader>
);

const MetricRow = ({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <span className={valueClassName}>{value}</span>
  </div>
);

const DataCard = ({
  icon,
  title,
  description,
  data,
  emptyMessage,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  data: unknown;
  emptyMessage: string;
  children: (data: unknown) => ReactNode;
  className?: string;
}) => (
  <Card className={cn(PANEL, className)}>
    <CardHeaderWithIcon icon={icon} title={title} description={description} />
    <CardContent className="pt-4">
      {data != null && (Array.isArray(data) ? data.length > 0 : true) ? (
        children(data)
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </CardContent>
  </Card>
);

type TableHeader = { key: string; label: string; width?: string; align?: string };

const TableCard = ({
  icon,
  title,
  description,
  data,
  emptyMessage,
  headers,
  renderRow,
  maxHeight = "max-h-[400px]",
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  data: unknown[];
  emptyMessage: string;
  headers: TableHeader[];
  renderRow: (item: unknown) => ReactNode;
  maxHeight?: string;
}) => (
  <DataCard
    icon={icon}
    title={title}
    description={description}
    data={data}
    emptyMessage={emptyMessage}
  >
    {(items) => {
      const rows = Array.isArray(items) ? items : [];
      return (
        <div className={cn("overflow-auto rounded-none border border-border/80", maxHeight)}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {headers.map(({ key, label, width, align }) => (
                  <TableHead key={key} className={cn("text-[11px] font-semibold uppercase tracking-wider", width || "", align || "")}>
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <Fragment key={idx}>{renderRow(row)}</Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }}
  </DataCard>
);

function QuickNav() {
  const { t } = useTranslation();
  const links = [
    { to: "/domains", label: "nav.domains", icon: Globe },
    { to: "/ssl", label: "nav.ssl", icon: Lock },
    { to: "/logs", label: "nav.logs", icon: FileText },
    { to: "/alerts", label: "nav.alerts", icon: AlertTriangle },
    { to: "/modsecurity", label: "nav.modsecurity", icon: Shield },
  ] as const;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("dashboard.quickNav")}</p>
      <div className="flex flex-wrap gap-2">
        {links.map(({ to, label, icon: Icon }) => (
          <Button
            key={to}
            variant="outline"
            size="sm"
            className="h-9 rounded-none border-foreground/15 bg-background text-foreground text-xs font-medium shadow-xs hover:text-accent-foreground [&_svg]:opacity-100"
            asChild
          >
            <Link to={to}>
              <Icon className="mr-1.5 h-3.5 w-3.5 text-foreground/80" />
              {t(label)}
              <ArrowRight className="ml-1 h-3 w-3 text-muted-foreground" />
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function HostLoadBars({
  cpuPct,
  memPct,
}: {
  cpuPct: number;
  memPct: number;
}) {
  const { t } = useTranslation();
  const Bar = ({ label, value }: { label: string; value: number }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-200">{value.toFixed(0)}%</span>
      </div>
      <div className="h-1 overflow-hidden bg-white/10">
        <div
          className={cn(
            "h-full transition-all",
            value > 85 ? "bg-red-400" : value > 70 ? "bg-amber-400" : "bg-emerald-400"
          )}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <Bar label="CPU" value={cpuPct} />
      <Bar label={t("dashboard.memory")} value={memPct} />
    </div>
  );
}

/** Hero, quick nav, optional alerts, host load, and KPI strip */
function DashboardHeaderAndMetrics() {
  const { t } = useTranslation();
  const { data: stats } = useSuspenseDashboardStats();

  const activeDomains = stats?.domains.active ?? 0;
  const errorDomains = stats?.domains.errors ?? 0;
  const unacknowledgedAlerts = stats?.alerts.unacknowledged ?? 0;
  const criticalAlerts = stats?.alerts.critical ?? 0;

  const health =
    criticalAlerts > 0 || errorDomains > 2
      ? "bad"
      : unacknowledgedAlerts > 0 || errorDomains > 0
        ? "warn"
        : "ok";

  const healthLabel =
    health === "bad"
      ? t("dashboard.health.action")
      : health === "warn"
        ? t("dashboard.health.watch")
        : t("dashboard.health.ok");

  const healthClass =
    health === "bad"
      ? "border-red-500/40 bg-red-500/15 text-red-100"
      : health === "warn"
        ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";

  const statsCards = [
    {
      title: t("dashboard.domains"),
      value: stats?.domains.total ?? 0,
      description: t("dashboard.stats.domainsDesc", { active: activeDomains, errors: errorDomains }),
      icon: Globe,
      glow: "from-cyan-500/20 to-transparent",
      iconBg: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    },
    {
      title: t("dashboard.traffic"),
      value: stats?.traffic.requestsPerDay ?? "0",
      description: t("dashboard.stats.requestsPerDay"),
      icon: Activity,
      glow: "from-emerald-500/20 to-transparent",
      iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: t("dashboard.errors"),
      value: errorDomains,
      description: t("dashboard.stats.errorsDesc"),
      icon: AlertTriangle,
      glow: "from-orange-500/25 to-transparent",
      iconBg: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    },
    {
      title: t("dashboard.uptime"),
      value: `${stats?.uptime ?? "0"}%`,
      description: t("dashboard.stats.uptimeDesc"),
      icon: CheckCircle2,
      glow: "from-violet-500/20 to-transparent",
      iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "relative overflow-hidden rounded-none border border-foreground/10 px-6 py-8 md:px-10 md:py-10",
          "bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-slate-100 shadow-xl shadow-black/20"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.2]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/15 blur-[110px]" />

        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              {t("dashboard.hero.badge")}
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">{t("dashboard.title")}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-300/95">{t("dashboard.hero.tagline")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-semibold tracking-wide",
                  healthClass
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    health === "ok" && "animate-pulse bg-emerald-400",
                    health === "warn" && "bg-amber-400",
                    health === "bad" && "bg-red-400"
                  )}
                />
                {healthLabel}
              </span>
              <span className="text-xs text-slate-500">{t("dashboard.overview")}</span>
            </div>
          </div>

          {stats?.system && (
            <div className="w-full min-w-[min(100%,280px)] rounded-none border border-white/10 bg-black/20 p-4 backdrop-blur-sm lg:max-w-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t("dashboard.cpuMem")}</p>
              <HostLoadBars cpuPct={stats.system.cpuUsage} memPct={stats.system.memoryUsage} />
            </div>
          )}
        </div>

        <div className="relative z-10 mt-8 border-t border-white/10 pt-6">
          <QuickNav />
        </div>
      </div>

      {unacknowledgedAlerts > 0 && (
        <div
          className={cn(
            PANEL,
            "flex flex-col gap-4 border-destructive/40 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-destructive">{t("dashboard.activeAlerts.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("dashboard.activeAlerts.body", {
                  count: unacknowledgedAlerts,
                  criticalPart:
                    criticalAlerts > 0 ? t("dashboard.activeAlerts.criticalPart", { count: criticalAlerts }) : "",
                })}
              </p>
            </div>
          </div>
          <Button variant="destructive" className="rounded-none shrink-0" asChild>
            <Link to="/alerts">
              {t("dashboard.openAlerts")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <div
            key={stat.title}
            className="group relative overflow-hidden rounded-none border border-foreground/10 bg-card/90 p-5 shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-lg dark:bg-card/75"
          >
            <div
              className={cn(
                "pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition-opacity group-hover:opacity-70",
                stat.glow
              )}
            />
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stat.title}</p>
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-none border border-foreground/5", stat.iconBg)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="relative mt-3 font-display text-3xl font-bold tabular-nums tracking-tight">{stat.value}</p>
            <p className="relative mt-1 text-xs leading-snug text-muted-foreground">{stat.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-48 rounded-none border border-foreground/10 bg-muted/40 animate-pulse md:h-56" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={`sk-${i}`}>
            <SkeletonStatsCard />
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestTrendChart() {
  const { t } = useTranslation();
  const { data: trendData } = useSuspenseRequestTrend(5);

  const chartConfig = Object.fromEntries(
    STATUS_CODES_CONFIG.map(({ key, color, label }) => [key, { label: t(label), color }])
  );

  return (
    <Card className={cn(PANEL, "lg:col-span-2")}>
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              {t("dashboard.requestTrend")}
            </CardTitle>
            <CardDescription>{t("dashboard.requestTrendDesc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {trendData && trendData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[min(22rem,50vh)] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis dataKey="timestamp" tickFormatter={(value) => formatTime(new Date(value))} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <ChartTooltip
                  content={<ChartTooltipContent labelFormatter={(label: string) => new Date(label).toLocaleString()} />}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                {STATUS_CODES_CONFIG.map(({ key, color, label }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    name={t(label)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <EmptyState message={t("dashboard.noData")} />
        )}
      </CardContent>
    </Card>
  );
}

function SlowRequestsCard() {
  const { t } = useTranslation();
  const { data: slowRequests } = useSuspenseSlowRequests(10);

  return (
    <DataCard
      icon={Clock}
      title={t("dashboard.slowRequests")}
      description={t("dashboard.slowRequestsDesc")}
      data={slowRequests}
      emptyMessage={t("dashboard.noData")}
    >
      {(data) => (
        <div className="space-y-2">
          {(data as { path: string; requestCount: number; avgResponseTime: number }[]).slice(0, 5).map((req, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 border border-border/60 bg-muted/30 py-2.5 pl-3 pr-2 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{req.path}</p>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.requestCount")}: {req.requestCount}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 font-mono text-xs">
                {req.avgResponseTime.toFixed(2)}ms
              </Badge>
            </div>
          ))}
        </div>
      )}
    </DataCard>
  );
}

function AttackRatioCard() {
  const { t } = useTranslation();
  const { data: attackRatio } = useSuspenseAttackRatio();

  const metrics = [
    { label: "dashboard.attackRequests", value: attackRatio?.attackRequests, variant: "destructive" as const },
    { label: "dashboard.normalRequests", value: attackRatio?.normalRequests, variant: "secondary" as const },
  ];

  return (
    <DataCard
      icon={Shield}
      title={t("dashboard.attackRatio")}
      description={t("dashboard.attackRatioDesc")}
      data={attackRatio}
      emptyMessage={t("dashboard.noData")}
    >
      {(data) => {
        const d = data as { totalRequests: number; attackPercentage: number; attackRequests?: number; normalRequests?: number };
        return (
          <div className="space-y-4">
            <MetricRow label={t("dashboard.totalRequests")} value={d.totalRequests.toLocaleString()} valueClassName="font-display text-2xl font-bold tabular-nums" />
            <div className="space-y-2 rounded-none border border-border/60 bg-muted/25 p-3">
              {metrics.map(({ label, value, variant }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t(label)}</span>
                  <Badge variant={variant}>{value?.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 pt-3">
              <MetricRow
                label={t("dashboard.attackPercentage")}
                value={`${d.attackPercentage.toFixed(2)}%`}
                valueClassName={cn("font-display text-xl font-bold tabular-nums", getAttackPercentageColor(d.attackPercentage))}
              />
            </div>
          </div>
        );
      }}
    </DataCard>
  );
}

function LatestAttacksCard() {
  const { t } = useTranslation();
  const { data: attacks } = useSuspenseLatestAttackStats(5);

  return (
    <DataCard
      icon={AlertTriangle}
      title={t("dashboard.latestAttacks")}
      description={t("dashboard.latestAttacksDesc")}
      data={attacks}
      emptyMessage={t("dashboard.noData")}
    >
      {(data) => (
        <div className="space-y-2">
          {(data as { attackType: string; lastOccurred: string; severity: string; count: number }[]).map((attack, idx) => (
            <Fragment key={idx}>
              <ListItem
                title={attack.attackType}
                subtitle={`${t("dashboard.lastOccurred")}: ${new Date(attack.lastOccurred).toLocaleString()}`}
                badge={<Badge variant={getSeverityVariant(attack.severity)}>{attack.count}</Badge>}
              />
            </Fragment>
          ))}
        </div>
      )}
    </DataCard>
  );
}

const NEWS_TABLE_HEADERS: TableHeader[] = [
  { key: "timestamp", label: "dashboard.timestamp", width: "w-[140px]" },
  { key: "attackerIp", label: "dashboard.attackerIp", width: "w-[120px]" },
  { key: "domain", label: "dashboard.domain", width: "w-[140px]" },
  { key: "attackType", label: "dashboard.attackType" },
  { key: "action", label: "dashboard.action" },
  { key: "actions", label: "dashboard.actions", align: "text-right" },
];

const IP_TABLE_HEADERS: TableHeader[] = [
  { key: "sourceIp", label: "dashboard.sourceIp" },
  { key: "requestCount", label: "dashboard.requestCount", align: "text-right" },
  { key: "errors", label: "dashboard.table.errors", align: "text-right" },
  { key: "attacks", label: "dashboard.table.attacks", align: "text-right" },
];

function LatestNewsTable() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: news } = useSuspenseLatestNews(10);

  const handleViewDetails = (item: { uniqueId?: string; ruleId?: string; attackType?: string }) => {
    if (item.uniqueId) {
      void navigate({
        to: "/logs",
        search: { uniqueId: String(item.uniqueId) },
      });
      return;
    }
    void navigate({
      to: "/logs",
      search: { search: String(item.ruleId || item.attackType || "") },
    });
  };

  const headers = NEWS_TABLE_HEADERS.map((h) => ({ ...h, label: t(h.label) }));

  return (
    <TableCard
      icon={TrendingUp}
      title={t("dashboard.latestNews")}
      description={t("dashboard.latestNewsDesc")}
      data={news || []}
      emptyMessage={t("dashboard.noData")}
      headers={headers}
      renderRow={(item: unknown) => {
        const row = item as {
          id: string;
          timestamp: string;
          attackerIp: string;
          domain?: string;
          attackType: string;
          action: string;
          uniqueId?: string;
          ruleId?: string;
        };
        return (
          <TableRow key={row.id} className="hover:bg-muted/30">
            <TableCell className="whitespace-nowrap font-mono text-xs">{new Date(row.timestamp).toLocaleString()}</TableCell>
            <TableCell className="font-mono text-sm">{row.attackerIp}</TableCell>
            <TableCell className="max-w-[140px] truncate text-sm">{row.domain || "—"}</TableCell>
            <TableCell>
              <Badge variant="outline">{row.attackType}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="destructive">{row.action}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" className="rounded-none" onClick={() => handleViewDetails(row)}>
                <Eye className="mr-1 h-4 w-4" />
                {t("dashboard.viewDetails")}
              </Button>
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

function RequestAnalyticsCard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const { data: analytics } = useSuspenseRequestAnalytics(period);

  const periods = ["day", "week", "month"] as const;
  const headers = IP_TABLE_HEADERS.map((h) => ({
    ...h,
    label: t(h.label),
  }));

  return (
    <Card className={PANEL}>
      <CardHeader className="border-b border-border/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              {t("dashboard.requestAnalytics")}
            </CardTitle>
            <CardDescription>{t("dashboard.requestAnalyticsDesc")}</CardDescription>
          </div>
          <Select value={period} onValueChange={(value: "day" | "week" | "month") => setPeriod(value)}>
            <SelectTrigger className="w-full rounded-none border-foreground/15 sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`dashboard.period.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {analytics && analytics.topIps.length > 0 ? (
          <div className="overflow-auto rounded-none border border-border/80">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {headers.map(({ key, label, align }) => (
                    <TableHead key={key} className={cn("text-[11px] font-semibold uppercase tracking-wider", align || "")}>
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topIps.map((ip: { ip: string; requestCount: number; errorCount: number; attackCount: number }, idx: number) => (
                  <TableRow key={idx} className="hover:bg-muted/20">
                    <TableCell className="font-mono">{ip.ip}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{ip.requestCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <CountBadge count={ip.errorCount} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CountBadge count={ip.attackCount} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState message={t("dashboard.noData")} />
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardNew() {
  const { t } = useTranslation();

  const rows = [
    {
      cols: "lg:grid-cols-3",
      items: [
        {
          component: <RequestTrendChart />,
          fallback: (
            <SkeletonChart title={t("dashboard.requestTrend")} description={t("dashboard.requestTrendDesc")} height="h-[min(22rem,50vh)]" />
          ),
          className: "lg:col-span-2",
        },
        { component: <AttackRatioCard />, fallback: <SkeletonChart title={t("dashboard.attackRatio")} /> },
      ],
    },
    {
      cols: "lg:grid-cols-2",
      items: [
        { component: <LatestAttacksCard />, fallback: <SkeletonChart title={t("dashboard.latestAttacks")} /> },
        { component: <RequestAnalyticsCard />, fallback: <SkeletonTable rows={5} columns={4} title={t("dashboard.requestAnalytics")} /> },
      ],
    },
    {
      cols: "lg:grid-cols-2",
      items: [
        { component: <SlowRequestsCard />, fallback: <SkeletonChart title={t("dashboard.slowRequests")} /> },
        { component: <LatestNewsTable />, fallback: <SkeletonTable rows={8} columns={6} title={t("dashboard.latestNews")} /> },
      ],
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      <Suspense fallback={<HeaderSkeleton />}>
        <DashboardHeaderAndMetrics />
      </Suspense>

      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className={cn("grid gap-4", row.cols)}>
          {row.items.map((item, itemIdx) => (
            <Suspense key={itemIdx} fallback={item.fallback}>
              <div className={item.className || ""}>{item.component}</div>
            </Suspense>
          ))}
        </div>
      ))}
    </div>
  );
}
