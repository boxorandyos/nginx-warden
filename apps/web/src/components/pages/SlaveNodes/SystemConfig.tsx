import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Server, Link as LinkIcon, CheckCircle2, AlertCircle, Loader2, RefreshCw, XCircle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { systemConfigService } from "@/services/system-config.service";

interface SystemConfigProps {
  systemConfig: any;
  isLoading: boolean;
}

const SystemConfig = ({ systemConfig, isLoading }: SystemConfigProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [masterFormData, setMasterFormData] = useState({
    masterHost: systemConfig?.masterHost || "",
    masterPort: systemConfig?.masterPort || 3001,
    masterApiKey: "",
    syncInterval: systemConfig?.syncInterval || 60
  });
  
  const [isMasterDialogOpen, setIsMasterDialogOpen] = useState(false);
  const [disconnectDialog, setDisconnectDialog] = useState(false);

  const [modeChangeDialog, setModeChangeDialog] = useState<{ open: boolean; newMode: 'master' | 'slave' | null }>({
    open: false,
    newMode: null
  });

  const [kaForm, setKaForm] = useState({
    keepalivedEnabled: false,
    keepalivedVirtualIp: '',
    keepalivedVrrpInterface: '',
    keepalivedRouterId: 51,
    keepalivedPriorityMaster: 150,
    keepalivedPriorityBackup: 100,
    keepalivedAuthPass: '',
  });

  useEffect(() => {
    if (!systemConfig) return;
    setKaForm((prev) => ({
      ...prev,
      keepalivedEnabled: systemConfig.keepalivedEnabled ?? false,
      keepalivedVirtualIp: systemConfig.keepalivedVirtualIp ?? '',
      keepalivedVrrpInterface: systemConfig.keepalivedVrrpInterface ?? '',
      keepalivedRouterId: systemConfig.keepalivedRouterId ?? 51,
      keepalivedPriorityMaster: systemConfig.keepalivedPriorityMaster ?? 150,
      keepalivedPriorityBackup: systemConfig.keepalivedPriorityBackup ?? 100,
      keepalivedAuthPass: '',
    }));
  }, [systemConfig]);

  const updateNodeModeMutation = useMutation({
    mutationFn: systemConfigService.updateNodeMode,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      
      toast({
        title: t("nodes.system.toast.modeChanged"),
        description: t("nodes.system.toast.modeChangedDesc", {
          mode: data.data.nodeMode === 'master'
            ? t("nodes.system.modeMaster")
            : t("nodes.system.modeSlave"),
        }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("nodes.system.toast.modeFailed"),
        description: error.response?.data?.message || t("common.error"),
        variant: "destructive"
      });
    }
  });

  const connectToMasterMutation = useMutation({
    mutationFn: systemConfigService.connectToMaster,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      setIsMasterDialogOpen(false);
      resetMasterForm();
      
      toast({
        title: t("nodes.system.toast.connected"),
        description: t("nodes.system.toast.connectedDesc", {
          host: data.data.masterHost,
          port: data.data.masterPort,
        }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("nodes.system.toast.connectionFailed"),
        description: error.response?.data?.message || t("nodes.toast.registerFailed"),
        variant: "destructive"
      });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: systemConfigService.disconnectFromMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      
      toast({
        title: t("nodes.system.toast.disconnected"),
        description: t("nodes.system.toast.disconnectedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("nodes.system.toast.disconnectFailed"),
        description: error.response?.data?.message || t("common.error"),
        variant: "destructive"
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: systemConfigService.testMasterConnection,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      
      toast({
        title: t("nodes.system.toast.testOk"),
        description: t("nodes.system.toast.testOkDesc", {
          latency: data.data.latency,
          status: data.data.masterStatus,
        }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("nodes.system.toast.testFailed"),
        description: error.response?.data?.message || t("common.error"),
        variant: "destructive"
      });
    }
  });

  const updateKeepalivedMutation = useMutation({
    mutationFn: systemConfigService.updateKeepalived,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      toast({
        title: t("common.success"),
        description: t("nodes.system.keepalivedToastOk"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("common.error"),
        variant: "destructive",
      });
    },
  });

  const syncFromMasterMutation = useMutation({
    mutationFn: systemConfigService.syncWithMaster,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      
      toast({
        title: t("nodes.system.toast.syncOk"),
        description: t("nodes.system.toast.syncOkDesc", { count: data.data.changesApplied }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("nodes.system.toast.syncFailed"),
        description: error.response?.data?.message || t("common.error"),
        variant: "destructive"
      });
    }
  });

  const handleConnectToMaster = () => {
    if (!masterFormData.masterHost || !masterFormData.masterApiKey) {
      toast({
        title: t("common.validationError"),
        description: t("nodes.system.toast.validationHostKey"),
        variant: "destructive"
      });
      return;
    }

    if (masterFormData.syncInterval < 10) {
      toast({
        title: t("common.validationError"),
        description: t("nodes.system.toast.validationSyncInterval"),
        variant: "destructive"
      });
      return;
    }

    connectToMasterMutation.mutate({
      masterHost: masterFormData.masterHost,
      masterPort: masterFormData.masterPort,
      masterApiKey: masterFormData.masterApiKey,
      syncInterval: masterFormData.syncInterval
    });
  };

  const resetMasterForm = () => {
    setMasterFormData({
      masterHost: systemConfig?.masterHost || "",
      masterPort: systemConfig?.masterPort || 3001,
      masterApiKey: "",
      syncInterval: systemConfig?.syncInterval || 60
    });
  };

  const handleModeChange = (newMode: 'master' | 'slave') => {
    if (systemConfig?.nodeMode === newMode) return;

    setModeChangeDialog({
      open: true,
      newMode
    });
  };

  const confirmModeChange = () => {
    if (modeChangeDialog.newMode) {
      updateNodeModeMutation.mutate(modeChangeDialog.newMode);
      setModeChangeDialog({ open: false, newMode: null });
    }
  };

  const currentMode = systemConfig?.nodeMode || 'master';
  const isMasterMode = currentMode === 'master';
  const isSlaveMode = currentMode === 'slave';

  const {
    data: hostIfaces,
    isLoading: hostIfacesLoading,
    isError: hostIfacesError,
  } = useQuery({
    queryKey: ['system-network-interfaces'],
    queryFn: async () => {
      const r = await systemConfigService.getNetworkInterfaces();
      return r.data?.interfaces ?? [];
    },
    enabled: isMasterMode && !isLoading,
    staleTime: 30_000,
  });
  const ifaces: string[] = Array.isArray(hostIfaces) ? hostIfaces : [];

  const fmt = (d: string | Date) => new Date(d).toLocaleString(i18n.language);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Server className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("nodes.system.title")}</h1>
            <p className="text-muted-foreground">{t("nodes.system.subtitle")}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <div>
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
      ) : (
        <Alert className={isMasterMode ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-green-500 bg-green-50 dark:bg-green-900/20'}>
          {isMasterMode ? (
            <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <LinkIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
          <AlertTitle>
            {t("nodes.system.currentModeTitle")}:{" "}
            <span className={isMasterMode ? 'text-blue-700 dark:text-blue-300' : 'text-green-700 dark:text-green-300'}>
              {isMasterMode ? t("nodes.system.modeMaster") : t("nodes.system.modeSlave")}
            </span>
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {isMasterMode ? t("nodes.system.masterHelp") : t("nodes.system.slaveHelp")}
            </span>
            <div className="flex items-center gap-2">
              {isSlaveMode && systemConfig?.connected && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {t("nodes.system.badgeConnected")}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleModeChange(isMasterMode ? 'slave' : 'master')}
                disabled={updateNodeModeMutation.isPending}
              >
                {updateNodeModeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  isMasterMode ? (
                    <LinkIcon className="h-4 w-4 mr-2" />
                  ) : (
                    <Server className="h-4 w-4 mr-2" />
                  )
                )}
                {isMasterMode ? t("nodes.system.switchToSlave") : t("nodes.system.switchToMaster")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && isMasterMode && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>{t("nodes.system.keepalivedTitle")}</CardTitle>
                <CardDescription className="mt-1.5">
                  {t("nodes.system.keepalivedDesc")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{t("nodes.system.keepalivedEnabled")}</p>
                <p className="text-xs text-muted-foreground">{t("nodes.system.keepalivedEnabledHint")}</p>
              </div>
              <Switch
                checked={kaForm.keepalivedEnabled}
                onCheckedChange={(c) => setKaForm((f) => ({ ...f, keepalivedEnabled: c }))}
              />
            </div>
            {kaForm.keepalivedEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="kvip">{t("nodes.system.keepalivedVip")}</Label>
                  <Input
                    id="kvip"
                    value={kaForm.keepalivedVirtualIp}
                    onChange={(e) => setKaForm((f) => ({ ...f, keepalivedVirtualIp: e.target.value }))}
                    placeholder="192.168.1.100/24"
                    className="font-mono"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="kiface">{t("nodes.system.keepalivedIface")}</Label>
                  {hostIfacesLoading && <Skeleton className="h-9 w-full" />}
                  {hostIfacesError && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("nodes.system.keepalivedIfaceListError")}
                    </p>
                  )}
                  {!hostIfacesLoading && !hostIfacesError && ifaces.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t("nodes.system.keepalivedIfaceEmpty")}</p>
                  )}
                  {!hostIfacesLoading && ifaces.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("nodes.system.keepalivedIfacePickerHint")}</p>
                      <Select
                        value={
                          ifaces.includes(kaForm.keepalivedVrrpInterface?.trim() ?? "")
                            ? (kaForm.keepalivedVrrpInterface?.trim() ?? "")
                            : undefined
                        }
                        onValueChange={(v) =>
                          setKaForm((f) => ({ ...f, keepalivedVrrpInterface: v }))
                        }
                      >
                        <SelectTrigger id="kiface-select" className="w-full max-w-md font-mono" size="default">
                          <SelectValue placeholder={t("nodes.system.keepalivedIfacePicker")} />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {ifaces.map((name) => (
                            <SelectItem key={name} value={name} className="font-mono">
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Input
                    id="kiface"
                    value={kaForm.keepalivedVrrpInterface}
                    onChange={(e) => setKaForm((f) => ({ ...f, keepalivedVrrpInterface: e.target.value }))}
                    placeholder="eth0 / ens18"
                    className="font-mono max-w-md"
                  />
                  <p className="text-xs text-muted-foreground">{t("nodes.system.keepalivedIfaceHelp")}</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kvrid">{t("nodes.system.keepalivedVrid")}</Label>
                  <Input
                    id="kvrid"
                    type="number"
                    min={1}
                    max={255}
                    value={kaForm.keepalivedRouterId}
                    onChange={(e) => setKaForm((f) => ({ ...f, keepalivedRouterId: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kpm">{t("nodes.system.keepalivedPrioMaster")}</Label>
                  <Input
                    id="kpm"
                    type="number"
                    min={1}
                    max={255}
                    value={kaForm.keepalivedPriorityMaster}
                    onChange={(e) => setKaForm((f) => ({ ...f, keepalivedPriorityMaster: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kpb">{t("nodes.system.keepalivedPrioBackup")}</Label>
                  <Input
                    id="kpb"
                    type="number"
                    min={1}
                    max={255}
                    value={kaForm.keepalivedPriorityBackup}
                    onChange={(e) => setKaForm((f) => ({ ...f, keepalivedPriorityBackup: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="kauth">{t("nodes.system.keepalivedAuth")}</Label>
                  <Input
                    id="kauth"
                    type="password"
                    autoComplete="new-password"
                    value={kaForm.keepalivedAuthPass}
                    onChange={(e) => setKaForm((f) => ({ ...f, keepalivedAuthPass: e.target.value }))}
                    placeholder={systemConfig?.keepalivedAuthPassSet ? t("nodes.system.keepalivedAuthKeep") : "warden01"}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">{t("nodes.system.keepalivedAuthHint")}</p>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground border-t pt-3">{t("nodes.system.keepalivedFootnote")}</p>
            <Button
              type="button"
              disabled={updateKeepalivedMutation.isPending}
              onClick={() =>
                updateKeepalivedMutation.mutate({
                  keepalivedEnabled: kaForm.keepalivedEnabled,
                  keepalivedVirtualIp: kaForm.keepalivedVirtualIp || null,
                  keepalivedVrrpInterface: kaForm.keepalivedVrrpInterface || null,
                  keepalivedRouterId: kaForm.keepalivedRouterId,
                  keepalivedAuthPass: kaForm.keepalivedAuthPass || undefined,
                  keepalivedPriorityMaster: kaForm.keepalivedPriorityMaster,
                  keepalivedPriorityBackup: kaForm.keepalivedPriorityBackup,
                })
              }
            >
              {updateKeepalivedMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              {t("nodes.system.keepalivedSave")}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && isSlaveMode && (
        <Card>
          <CardContent className="pt-6">
            {!systemConfig?.connected ? (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t("nodes.system.slaveDisconnected")}
                  </AlertDescription>
                </Alert>

                <Button className="w-full" onClick={() => setIsMasterDialogOpen(true)}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  {t("nodes.system.connectToMasterBtn")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">{t("nodes.system.connectedHeading")}</span>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    {t("nodes.system.active")}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("nodes.system.labelMasterHost")}:</span>
                    <span className="font-mono">{systemConfig.masterHost}:{systemConfig.masterPort}</span>
                  </div>
                  {systemConfig.lastConnectedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("nodes.system.labelLastConnected")}:</span>
                      <span>{fmt(systemConfig.lastConnectedAt)}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => syncFromMasterMutation.mutate()}
                    disabled={syncFromMasterMutation.isPending}
                  >
                    {syncFromMasterMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {t("nodes.system.syncFromMaster")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending}
                  >
                    {testConnectionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {t("nodes.system.testConnection")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDisconnectDialog(true)}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    {t("nodes.system.disconnect")}
                  </Button>
                </div>
              </div>
            )}
            {systemConfig?.connected && systemConfig?.keepalivedEnabled && (
              <Alert className="mt-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-sm">{t("nodes.system.keepalivedSlaveNote")}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={modeChangeDialog.open} onOpenChange={(open) => setModeChangeDialog({ ...modeChangeDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              {t("nodes.system.confirmModeTitle")}
            </DialogTitle>
            <DialogDescription>
              {modeChangeDialog.newMode === 'slave'
                ? t("nodes.system.confirmToSlave")
                : t("nodes.system.confirmToMaster")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setModeChangeDialog({ open: false, newMode: null })}
              disabled={updateNodeModeMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={confirmModeChange}
              disabled={updateNodeModeMutation.isPending}
            >
              {updateNodeModeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {updateNodeModeMutation.isPending ? t("nodes.system.changing") : t("nodes.system.continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMasterDialogOpen} onOpenChange={setIsMasterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("nodes.system.connectDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("nodes.system.connectDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="masterHost">{t("nodes.system.masterHostIp")}</Label>
              <Input
                id="masterHost"
                value={masterFormData.masterHost}
                onChange={(e) => setMasterFormData({ ...masterFormData, masterHost: e.target.value })}
                placeholder={t("nodes.system.masterHostPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="masterPort">{t("nodes.system.masterPort")}</Label>
              <Input
                id="masterPort"
                type="number"
                value={masterFormData.masterPort}
                onChange={(e) => setMasterFormData({ ...masterFormData, masterPort: Number(e.target.value) })}
                placeholder="3001"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="masterApiKey">{t("nodes.system.masterApiKey")}</Label>
              <Input
                id="masterApiKey"
                type="password"
                value={masterFormData.masterApiKey}
                onChange={(e) => setMasterFormData({ ...masterFormData, masterApiKey: e.target.value })}
                placeholder={t("nodes.system.masterApiKeyPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("nodes.system.masterApiKeyHint")}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="syncInterval">{t("nodes.system.syncIntervalLabel")}</Label>
              <Input
                id="syncInterval"
                type="number"
                value={masterFormData.syncInterval}
                onChange={(e) => setMasterFormData({ ...masterFormData, syncInterval: Number(e.target.value) })}
                placeholder="60"
              />
              <p className="text-xs text-muted-foreground">
                {t("nodes.system.syncIntervalHint")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMasterDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleConnectToMaster}
              disabled={connectToMasterMutation.isPending}
            >
              {connectToMasterMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("nodes.system.connect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disconnectDialog} onOpenChange={setDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              {t("nodes.system.confirmDisconnectTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("nodes.system.confirmDisconnectDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDisconnectDialog(false)}
              disabled={disconnectMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                disconnectMutation.mutate();
                setDisconnectDialog(false);
              }}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {disconnectMutation.isPending ? t("nodes.system.disconnecting") : t("nodes.system.disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemConfig;
