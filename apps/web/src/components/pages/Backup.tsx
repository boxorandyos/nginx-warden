import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Download, Upload, Play, Trash2, Calendar, FileArchive, Database, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { backupService, BackupSchedule } from "@/services/backup.service";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";

const Backup = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupSchedule[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importWarningOpen, setImportWarningOpen] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    schedule: "0 2 * * *",
    enabled: true
  });

  // Load backup schedules
  useEffect(() => {
    loadBackupSchedules();
  }, []);

  const loadBackupSchedules = async () => {
    try {
      const data = await backupService.getSchedules();
      setBackups(data);
    } catch (error: any) {
      toast({
        title: t("backup.toast.loadFailed"),
        description: error.response?.data?.message || t("backup.toast.loadFailedDesc"),
        variant: "destructive",
      });
    }
  };

  const handleAddBackup = async () => {
    if (!formData.name.trim()) {
      toast({
        title: t("common.validationError"),
        description: t("backup.toast.validationName"),
        variant: "destructive",
      });
      return;
    }

    try {
      await backupService.createSchedule({
        name: formData.name,
        schedule: formData.schedule,
        enabled: formData.enabled
      });
      
      setIsDialogOpen(false);
      resetForm();
      loadBackupSchedules();
      
      toast({
        title: t("common.success"),
        description: t("backup.toast.created"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("backup.toast.createFailed"),
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      schedule: "0 2 * * *",
      enabled: true
    });
  };

  const handleToggle = async (id: string) => {
    try {
      await backupService.toggleSchedule(id);
      loadBackupSchedules();
      toast({
        title: t("common.success"),
        description: t("backup.toast.updated"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("backup.toast.toggleFailed"),
        variant: "destructive",
      });
    }
  };

  const confirmDelete = (id: string) => {
    setScheduleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!scheduleToDelete) return;

    try {
      await backupService.deleteSchedule(scheduleToDelete);
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
      loadBackupSchedules();
      toast({
        title: t("common.success"),
        description: t("backup.toast.deleted"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("backup.toast.deleteFailed"),
        variant: "destructive",
      });
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      toast({
        title: t("backup.toast.started"),
        description: t("backup.toast.startedDesc"),
      });

      const result = await backupService.runNow(id);
      loadBackupSchedules();

      toast({
        title: t("backup.toast.completed"),
        description: t("backup.toast.completedDesc", {
          filename: result.filename,
          size: result.size,
        }),
      });
    } catch (error: any) {
      toast({
        title: t("backup.toast.runFailedTitle"),
        description: error.response?.data?.message || t("backup.toast.runFailed"),
        variant: "destructive",
      });
    }
  };

  const handleExportConfig = async () => {
    try {
      setExportLoading(true);
      const blob = await backupService.exportConfig();
      
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `nginx-config-${timestamp}.json`;
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: t("common.success"),
        description: t("backup.toast.exportSuccess"),
      });
    } catch (error: any) {
      toast({
        title: t("backup.toast.exportFailedTitle"),
        description: error.response?.data?.message || t("backup.toast.exportFailed"),
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportConfig = () => {
    // Open warning dialog first
    setImportWarningOpen(true);
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.json')) {
      toast({
        title: t("backup.toast.invalidFileTitle"),
        description: t("backup.toast.invalidFile"),
        variant: "destructive",
      });
      return;
    }
    
    setPendingImportFile(file);
    setImportWarningOpen(false);
    setImportConfirmOpen(true);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const openFileDialog = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    };
    
    input.click();
  };

  const confirmImport = async () => {
    if (!pendingImportFile) return;

    try {
      setImportLoading(true);
      setImportConfirmOpen(false);
      
      const text = await pendingImportFile.text();
      const data = JSON.parse(text);
      
      const result = await backupService.importConfig(data);
      
      toast({
        title: t("backup.toast.restoreSuccess"),
        description: t("backup.toast.restoreSuccessDesc", {
          domains: result.domains,
          vhosts: result.vhostConfigs,
          upstreams: result.upstreams,
          lbs: result.loadBalancers,
          ssl: result.ssl,
          sslFiles: result.sslFiles,
          modsec: result.modsecCRS + result.modsecCustom,
          acl: result.acl,
          channels: result.alertChannels,
          alerts: result.alertRules,
          users: result.users,
          nginx: result.nginxConfigs,
        }),
        duration: 10000,
      });
      
      // Reload data
      loadBackupSchedules();
      setPendingImportFile(null);
    } catch (error: any) {
      toast({
        title: t("backup.toast.restoreFailedTitle"),
        description: error.response?.data?.message || t("backup.toast.restoreFailed"),
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setImportLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'failed': return 'destructive';
      case 'running': return 'secondary';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("backup.page.title")}</h1>
            <p className="text-muted-foreground">{t("backup.page.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("backup.export.title")}</CardTitle>
            <CardDescription>{t("backup.export.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("backup.export.body")}</p>
            <Button onClick={handleExportConfig} className="w-full" disabled={exportLoading}>
              {exportLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("backup.export.exporting")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t("backup.export.button")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("backup.import.title")}</CardTitle>
            <CardDescription>{t("backup.import.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("backup.import.body")}</p>
            <Button onClick={handleImportConfig} variant="outline" className="w-full" disabled={importLoading}>
              {importLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("backup.import.importing")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("backup.import.button")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("backup.schedules.title")}</CardTitle>
            <CardDescription>{t("backup.schedules.desc")}</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                {t("backup.schedules.add")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("backup.schedules.dialogTitle")}</DialogTitle>
                <DialogDescription>{t("backup.schedules.dialogDesc")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("backup.schedules.name")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("backup.schedules.namePlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="schedule">{t("backup.schedules.cron")}</Label>
                  <Input
                    id="schedule"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    placeholder="0 2 * * *"
                  />
                  <p className="text-xs text-muted-foreground">{t("backup.schedules.cronHint")}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label htmlFor="enabled">{t("backup.schedules.enable")}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleAddBackup}>{t("backup.schedules.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("backup.table.name")}</TableHead>
                  <TableHead>{t("backup.table.schedule")}</TableHead>
                  <TableHead>{t("backup.table.lastRun")}</TableHead>
                  <TableHead>{t("backup.table.nextRun")}</TableHead>
                  <TableHead>{t("backup.table.status")}</TableHead>
                  <TableHead>{t("backup.table.size")}</TableHead>
                  <TableHead>{t("backup.table.enabled")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-medium">{backup.name}</TableCell>
                    <TableCell className="font-mono text-sm">{backup.schedule}</TableCell>
                    <TableCell className="text-sm">
                      {backup.lastRun ? new Date(backup.lastRun).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {backup.nextRun ? new Date(backup.nextRun).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(backup.status)}>
                        {backup.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{backup.size || '-'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={backup.enabled}
                        onCheckedChange={() => handleToggle(backup.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleRunNow(backup.id)}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => confirmDelete(backup.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("backup.info.title")}</CardTitle>
          <CardDescription>{t("backup.info.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-2">
            <FileArchive className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t("backup.info.whatTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("backup.info.whatBody")}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileArchive className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t("backup.info.processTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("backup.info.processBody")}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileArchive className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t("backup.info.bestTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("backup.info.bestBody")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backup.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("backup.delete.desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Warning Dialog with File Upload */}
      <Dialog open={importWarningOpen} onOpenChange={setImportWarningOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Upload className="h-6 w-6 text-orange-500" />
              {t("backup.importDialog.title")}
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <div className="bg-red-50 dark:bg-red-950 border-2 border-red-300 dark:border-red-800 rounded-lg p-4">
                <p className="font-bold text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
                  <span className="text-2xl">⚠️</span>
                  {t("backup.importDialog.criticalTitle")}
                </p>
                <p className="text-sm text-red-800 dark:text-red-200">{t("backup.importDialog.criticalBody")}</p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <p className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                  {t("backup.importDialog.replacedTitle")}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm text-orange-800 dark:text-orange-200">
                  <div>• {t("backup.importDialog.replaced1")}</div>
                  <div>• {t("backup.importDialog.replaced2")}</div>
                  <div>• {t("backup.importDialog.replaced3")}</div>
                  <div>• {t("backup.importDialog.replaced4")}</div>
                  <div>• {t("backup.importDialog.replaced5")}</div>
                  <div>• {t("backup.importDialog.replaced6")}</div>
                  <div>• {t("backup.importDialog.replaced7")}</div>
                  <div>• {t("backup.importDialog.replaced8")}</div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-900 dark:text-yellow-100 font-semibold mb-2">
                  {t("backup.importDialog.beforeTitle")}
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-200 pl-2">
                  <li>{t("backup.importDialog.before1")}</li>
                  <li>{t("backup.importDialog.before2")}</li>
                  <li>{t("backup.importDialog.before3")}</li>
                  <li>{t("backup.importDialog.before4")}</li>
                </ul>
              </div>

              {/* File Upload Zone */}
              <div className="pt-4">
                <Label className="text-base font-semibold mb-3 block">{t("backup.importDialog.dropLabel")}</Label>
                <div
                  onDrop={handleFileDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={openFileDialog}
                  className={`
                    relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-all duration-200 ease-in-out
                    ${isDragging 
                      ? 'border-primary bg-primary/5 scale-[1.02]' 
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`p-4 rounded-full ${isDragging ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-base font-medium">
                        {isDragging ? t("backup.importDialog.dropActive") : t("backup.importDialog.dropHint")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{t("backup.importDialog.accepts")}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <FileArchive className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{t("backup.importDialog.maxSize")}</span>
                    </div>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportWarningOpen(false)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import/Restore Confirmation Dialog */}
      <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <FileArchive className="h-6 w-6 text-orange-500" />
              {t("backup.confirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-4">
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <p className="font-semibold text-orange-900 dark:text-orange-100 mb-2">{t("backup.confirm.warningTitle")}</p>
                <p className="text-sm text-orange-800 dark:text-orange-200">{t("backup.confirm.warningBody")}</p>
              </div>

              <div className="space-y-3 text-sm">
                <p className="font-semibold text-foreground">{t("backup.confirm.listTitle")}</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
                  <li>{t("backup.confirm.item1")}</li>
                  <li>{t("backup.confirm.item2")}</li>
                  <li>{t("backup.confirm.item3")}</li>
                  <li>{t("backup.confirm.item4")}</li>
                  <li>{t("backup.confirm.item5")}</li>
                  <li>{t("backup.confirm.item6")}</li>
                  <li>{t("backup.confirm.item7")}</li>
                  <li>{t("backup.confirm.item8")}</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">{t("backup.confirm.afterTitle")}</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200 pl-2">
                  <li>{t("backup.confirm.after1")}</li>
                  <li>{t("backup.confirm.after2")}</li>
                  <li>{t("backup.confirm.after3")}</li>
                  <li>{t("backup.confirm.after4")}</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">{t("backup.confirm.recommend")}</p>
              </div>

              <p className="text-sm font-semibold text-foreground pt-2">{t("backup.confirm.question")}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingImportFile(null)}>
              {t("backup.confirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmImport}
              className="bg-orange-600 text-white hover:bg-orange-700"
              disabled={importLoading}
            >
              {importLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("backup.confirm.restoring")}
                </>
              ) : (
                <>{t("backup.confirm.submit")}</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Backup;
