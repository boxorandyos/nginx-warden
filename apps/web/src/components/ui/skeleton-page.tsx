import { useTranslation } from "react-i18next";
import { SkeletonStatsCard } from "./skeleton-stats-card";
import { SkeletonChart } from "./skeleton-chart";
import { SkeletonTable } from "./skeleton-table";
import { Skeleton } from "./skeleton";

interface SkeletonPageProps {
  type?: "dashboard" | "table" | "form" | "chart";
  /** @deprecated Top navigation is no longer sidebar-based; kept for API compatibility */
  showSidebar?: boolean;
  className?: string;
}

function TopChromeSkeleton() {
  return (
    <div className="flex h-14 shrink-0 items-center border-b border-foreground/10 px-4">
      <Skeleton className="h-9 w-36 rounded-none" />
      <div className="ml-6 hidden flex-1 gap-2 md:flex">
        <Skeleton className="h-9 w-20 rounded-none" />
        <Skeleton className="h-9 w-20 rounded-none" />
        <Skeleton className="h-9 w-24 rounded-none" />
      </div>
      <Skeleton className="ml-auto h-10 w-28 rounded-none" />
    </div>
  );
}

export function SkeletonPage({ 
  type = "dashboard", 
  showSidebar: _showSidebar = true,
  className 
}: SkeletonPageProps) {
  const { t } = useTranslation();

  const renderContent = () => {
    switch (type) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-9 w-48 rounded-none" />
                <Skeleton className="h-4 w-64 rounded-none" />
              </div>
              <Skeleton className="h-10 w-32 rounded-none" />
            </div>

            <div className="border border-destructive/20 p-4 rounded-none">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-none" />
                <Skeleton className="h-4 w-32 rounded-none" />
              </div>
              <Skeleton className="h-4 w-64 mt-2 rounded-none" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonStatsCard key={i} />
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SkeletonChart title={t("skeleton.dashboard.cpu")} description={t("skeleton.dashboard.cpuDesc")} />
              <SkeletonChart title={t("skeleton.dashboard.memory")} description={t("skeleton.dashboard.memoryDesc")} />
            </div>

            <SkeletonTable rows={5} columns={3} title={t("skeleton.dashboard.recentAlerts")} />
          </div>
        );

      case "table":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-9 w-48 rounded-none" />
                <Skeleton className="h-4 w-64 rounded-none" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-32 rounded-none" />
                <Skeleton className="h-10 w-24 rounded-none" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonStatsCard key={i} />
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <Skeleton className="h-10 w-64 rounded-none" />
            </div>

            <SkeletonTable rows={8} columns={6} showCard={false} />
          </div>
        );

      case "form":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-9 w-48 rounded-none" />
                <Skeleton className="h-4 w-64 rounded-none" />
              </div>
              <Skeleton className="h-10 w-32 rounded-none" />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24 rounded-none" />
                    <Skeleton className="h-10 w-full rounded-none" />
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24 rounded-none" />
                    <Skeleton className="h-10 w-full rounded-none" />
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-4">
                  <Skeleton className="h-10 w-20 rounded-none" />
                  <Skeleton className="h-10 w-24 rounded-none" />
                </div>
              </div>
            </div>
          </div>
        );

      case "chart":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-9 w-48 rounded-none" />
                <Skeleton className="h-4 w-64 rounded-none" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-32 rounded-none" />
                <Skeleton className="h-10 w-32 rounded-none" />
                <Skeleton className="h-10 w-32 rounded-none" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonStatsCard key={i} />
              ))}
            </div>

            <SkeletonChart 
              title={t("skeleton.chart.performanceTitle")} 
              description={t("skeleton.chart.performanceDesc")} 
              height="h-[400px]" 
            />

            <div className="grid gap-4 md:grid-cols-2">
              <SkeletonChart title={t("skeleton.chart.slowRequests")} description={t("skeleton.chart.slowRequestsDesc")} />
              <SkeletonChart title={t("skeleton.chart.errorPeriods")} description={t("skeleton.chart.errorPeriodsDesc")} />
            </div>
          </div>
        );

      default:
        return <Skeleton className="h-96 w-full rounded-none" />;
    }
  };

  return (
    <div className={`flex min-h-screen flex-col bg-background ${className ?? ""}`}>
      <TopChromeSkeleton />
      <div className="flex-1 border-x border-foreground/[0.06] p-6">
        {renderContent()}
      </div>
    </div>
  );
}
