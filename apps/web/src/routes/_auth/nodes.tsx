import { useQuery } from "@tanstack/react-query";
import { Server, Link as LinkIcon } from "lucide-react";
import { SystemConfig, SlaveNodes } from '@/components/pages/SlaveNodes'
import { createFileRoute } from '@tanstack/react-router'
import { systemConfigQueryOptions } from "@/queries/system-config.query-options";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export const Route = createFileRoute('/_auth/nodes')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation();

  // Fetch system configuration
  const { data: systemConfigData, isLoading: isConfigLoading } = useQuery(systemConfigQueryOptions.all);
  const systemConfig = systemConfigData?.data;

  const currentMode = systemConfig?.nodeMode || 'master';
  const isMasterMode = currentMode === 'master';

  const modeLabel = isMasterMode
    ? t("nodes.system.modeMaster")
    : t("nodes.system.modeSlave");

  return (
    <div className="space-y-6">
      <SystemConfig
        systemConfig={systemConfig}
        isLoading={isConfigLoading}
      />
      
      {!isConfigLoading && (
        <div className="space-y-4">
          <div
            className="grid w-full grid-cols-2 gap-0 rounded-lg border bg-muted/40 p-1 text-center text-sm"
            role="status"
            aria-label={t("nodes.modeViewAria", { mode: modeLabel })}
          >
            <div
              className={cn(
                "flex items-center justify-center gap-2 rounded-md py-2 font-medium transition-colors",
                isMasterMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              <Server className="h-4 w-4 shrink-0" aria-hidden />
              {t("nodes.modeSegment.master")}
            </div>
            <div
              className={cn(
                "flex items-center justify-center gap-2 rounded-md py-2 font-medium transition-colors",
                !isMasterMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              <LinkIcon className="h-4 w-4 shrink-0" aria-hidden />
              {t("nodes.modeSegment.slave")}
            </div>
          </div>

          {isMasterMode ? (
            <SlaveNodes systemConfig={systemConfig} />
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm max-w-lg mx-auto">
              {t("nodes.slaveSectionPlaceholder")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
