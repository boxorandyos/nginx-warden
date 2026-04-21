import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkeletonTable } from "@/components/ui/skeletons";
import { Server, RefreshCw, Trash2, CheckCircle2, XCircle, Clock, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { slaveNodesQueryOptions } from "@/queries/slave.query-options";
import { slaveNodeService } from "@/services/slave.service";

interface SlaveNodesProps {
  systemConfig: any;
}

const SlaveNodes = ({ systemConfig }: SlaveNodesProps) => {
  void systemConfig;
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [slaveFormData, setSlaveFormData] = useState({
    name: "",
    host: "",
    port: 3001,
    syncInterval: 60
  });
  
  const [apiKeyDialog, setApiKeyDialog] = useState<{ open: boolean; apiKey: string }>({
    open: false,
    apiKey: ''
  });

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; nodeId: string | null }>({
    open: false,
    nodeId: null
  });

  const { data: nodes = [], isLoading: isNodesLoading } = useQuery({
    ...slaveNodesQueryOptions.all,
    refetchInterval: 30000
  });

  const registerMutation = useMutation({
    mutationFn: slaveNodeService.register,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['slave-nodes'] });
      setIsDialogOpen(false);
      resetSlaveForm();
      
      setApiKeyDialog({
        open: true,
        apiKey: data.data.apiKey
      });
      
      toast({ 
        title: t("nodes.toast.registered"),
        description: t("nodes.toast.registeredDesc", { name: data.data.name }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("nodes.registrationFailed"),
        description: error.response?.data?.message || t("nodes.toast.registerFailed"),
        variant: "destructive",
        duration: 5000
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: slaveNodeService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slave-nodes'] });
      toast({ title: t("nodes.toast.removed") });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("nodes.toast.removeFailed"),
        variant: "destructive"
      });
    }
  });

  const handleRegisterSlave = () => {
    if (!slaveFormData.name || !slaveFormData.host) {
      toast({
        title: t("common.validationError"),
        description: t("nodes.validation.nameHost"),
        variant: "destructive"
      });
      return;
    }

    registerMutation.mutate({
      name: slaveFormData.name,
      host: slaveFormData.host,
      port: slaveFormData.port,
      syncInterval: slaveFormData.syncInterval
    });
  };

  const resetSlaveForm = () => {
    setSlaveFormData({
      name: "",
      host: "",
      port: 3001,
      syncInterval: 60
    });
  };

  const handleDelete = (id: string) => {
    setDeleteDialog({ open: true, nodeId: id });
  };

  const confirmDelete = () => {
    if (deleteDialog.nodeId) {
      deleteMutation.mutate(deleteDialog.nodeId);
      setDeleteDialog({ open: false, nodeId: null });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'default';
      case 'offline': return 'destructive';
      case 'syncing': return 'secondary';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle2 className="h-4 w-4" />;
      case 'offline': return <XCircle className="h-4 w-4" />;
      case 'syncing': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const fmt = (d: string | Date) => new Date(d).toLocaleString(i18n.language);

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>{t("nodes.cardTitle")}</CardTitle>
          <CardDescription>
            {t("nodes.cardDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">{t("nodes.registeredSection")}</h3>
              <p className="text-sm text-muted-foreground">
                {isNodesLoading 
                  ? t("nodes.loading")
                  : t("nodes.summary", { count: nodes.length })
                }
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Server className="h-4 w-4 mr-2" />
                    {t("nodes.registerButton")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("nodes.registerDialogTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("nodes.registerDialogDesc")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">{t("nodes.field.name")}</Label>
                      <Input
                        id="name"
                        value={slaveFormData.name}
                        onChange={(e) => setSlaveFormData({ ...slaveFormData, name: e.target.value })}
                        placeholder="slave-node-01"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="host">{t("nodes.slaveHost")}</Label>
                      <Input
                        id="host"
                        value={slaveFormData.host}
                        onChange={(e) => setSlaveFormData({ ...slaveFormData, host: e.target.value })}
                        placeholder={t("nodes.hostPlaceholder")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="port">{t("nodes.field.port")}</Label>
                      <Input
                        id="port"
                        type="number"
                        value={slaveFormData.port}
                        onChange={(e) => setSlaveFormData({ ...slaveFormData, port: Number(e.target.value) })}
                        placeholder="3001"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={handleRegisterSlave}
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t("nodes.register")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isNodesLoading ? (
            <SkeletonTable rows={5} columns={6} showCard={false} />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("nodes.table.name")}</TableHead>
                    <TableHead>{t("nodes.table.hostPort")}</TableHead>
                    <TableHead>{t("nodes.table.status")}</TableHead>
                    <TableHead>{t("nodes.table.lastSeen")}</TableHead>
                    <TableHead>{t("nodes.table.configHash")}</TableHead>
                    <TableHead className="text-right">{t("nodes.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t("nodes.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    nodes.map((node) => (
                      <TableRow key={node.id}>
                        <TableCell className="font-medium">{node.name}</TableCell>
                        <TableCell className="font-mono text-sm">{node.host}:{node.port}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(node.status)}>
                            {getStatusIcon(node.status)}
                            <span className="ml-1">{node.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {node.lastSeen ? fmt(node.lastSeen) : t("nodes.lastSeenNever")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {node.configHash?.substring(0, 12) || 'N/A'}...
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(node.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={apiKeyDialog.open} onOpenChange={(open) => setApiKeyDialog({ ...apiKeyDialog, open })}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-yellow-500" />
              {t("nodes.apiKeyTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("nodes.apiKeyDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("nodes.apiKeyOnce")}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="apiKey">{t("nodes.dialog.apiKeyTitle")}</Label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  value={apiKeyDialog.apiKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeyDialog.apiKey);
                    toast({
                      title: t("nodes.toast.apiKeyCopiedTitle"),
                      description: t("nodes.toast.apiKeyCopiedDesc"),
                    });
                  }}
                >
                  {t("nodes.copyApiKey")}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">{t("nodes.nextStepsTitle")}</p>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>{t("nodes.nextSteps.1")}</li>
                <li>{t("nodes.nextSteps.2")}</li>
                <li>{t("nodes.nextSteps.3")}</li>
                <li>{t("nodes.nextSteps.4")}</li>
                <li>{t("nodes.nextSteps.5")}</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setApiKeyDialog({ open: false, apiKey: '' })}>
              {t("nodes.savedButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              {t("nodes.deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("nodes.deleteConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialog({ open: false, nodeId: null })}
              disabled={deleteMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleteMutation.isPending ? t("nodes.deleting") : t("nodes.deleteNode")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SlaveNodes;
