import { useState } from "react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Send, Trash2, Mail, MessageSquare, Loader2, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SkeletonTable } from "@/components/ui/skeletons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useSuspenseNotificationChannels,
  useSuspenseAlertRules,
  useCreateNotificationChannel,
  useUpdateNotificationChannel,
  useDeleteNotificationChannel,
  useTestNotificationChannel,
  useCreateAlertRule,
  useUpdateAlertRule,
  useDeleteAlertRule
} from "@/queries";

// Component for notification channels with suspense
function NotificationChannelsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: channels } = useSuspenseNotificationChannels();
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<{ id: string; name: string } | null>(null);

  const createNotificationChannel = useCreateNotificationChannel();
  const updateNotificationChannel = useUpdateNotificationChannel();
  const deleteNotificationChannel = useDeleteNotificationChannel();
  const testNotificationChannel = useTestNotificationChannel();

  const [channelForm, setChannelForm] = useState({
    name: "",
    type: "email" as "email" | "telegram",
    enabled: true,
    email: "",
    chatId: "",
    botToken: ""
  });

  const handleAddChannel = async () => {
    const config = channelForm.type === 'email'
      ? { email: channelForm.email }
      : { chatId: channelForm.chatId, botToken: channelForm.botToken };

    try {
      await createNotificationChannel.mutateAsync({
        name: channelForm.name,
        type: channelForm.type,
        enabled: channelForm.enabled,
        config
      });

      setIsChannelDialogOpen(false);
      resetChannelForm();
      toast({ title: t("alerts.channel.added") });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("alerts.channel.addFailed"),
        variant: "destructive",
      });
    }
  };

  const resetChannelForm = () => {
    setChannelForm({
      name: "",
      type: "email",
      enabled: true,
      email: "",
      chatId: "",
      botToken: ""
    });
  };

  const handleTestNotification = async (channelId: string) => {
    try {
      const channel = channels.find(c => c.id === channelId);
      const result = await testNotificationChannel.mutateAsync(channelId);
      toast({
        title: t("alerts.channel.testSent"),
        description:
          result.message ||
          t("alerts.channel.testTo", { name: channel?.name ?? "" }),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("alerts.channel.testFailed"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteChannel = async () => {
    if (!channelToDelete) return;

    try {
      await deleteNotificationChannel.mutateAsync(channelToDelete.id);
      toast({ title: t("alerts.channel.deleted") });
      setChannelToDelete(null);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("alerts.channel.deleteFailed"),
        variant: "destructive",
      });
    }
  };

  const handleToggleChannel = async (id: string) => {
    try {
      const channel = channels.find(c => c.id === id);
      if (!channel) return;

      await updateNotificationChannel.mutateAsync({
        id,
        data: { enabled: !channel.enabled }
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("alerts.channel.toggleFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t("alerts.channels.title")}</CardTitle>
          <CardDescription>{t("alerts.channels.desc")}</CardDescription>
        </div>
        <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("alerts.channels.add")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("alerts.channels.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("alerts.channels.dialogDesc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="channel-name">{t("alerts.channels.fieldName")}</Label>
                <Input
                  id="channel-name"
                  value={channelForm.name}
                  onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                  placeholder={t("alerts.channels.namePlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="channel-type">{t("alerts.channels.fieldType")}</Label>
                <Select value={channelForm.type} onValueChange={(value: any) => setChannelForm({ ...channelForm, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">{t("alerts.channels.type.email")}</SelectItem>
                    <SelectItem value="telegram">{t("alerts.channels.type.telegram")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {channelForm.type === 'email' ? (
                <div className="grid gap-2">
                  <Label htmlFor="email">{t("alerts.channels.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={channelForm.email}
                    onChange={(e) => setChannelForm({ ...channelForm, email: e.target.value })}
                    placeholder="admin@example.com"
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="chatId">{t("alerts.channels.chatId")}</Label>
                    <Input
                      id="chatId"
                      value={channelForm.chatId}
                      onChange={(e) => setChannelForm({ ...channelForm, chatId: e.target.value })}
                      placeholder="-1001234567890"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="botToken">{t("alerts.channels.botToken")}</Label>
                    <Input
                      id="botToken"
                      type="password"
                      value={channelForm.botToken}
                      onChange={(e) => setChannelForm({ ...channelForm, botToken: e.target.value })}
                      placeholder="1234567890:ABCdefGHI..."
                    />
                  </div>
                </>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  id="channel-enabled"
                  checked={channelForm.enabled}
                  onCheckedChange={(checked) => setChannelForm({ ...channelForm, enabled: checked })}
                />
                <Label htmlFor="channel-enabled">{t("alerts.channels.enable")}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsChannelDialogOpen(false)} disabled={createNotificationChannel.isPending}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAddChannel} disabled={createNotificationChannel.isPending}>
                {createNotificationChannel.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("alerts.channels.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.type")}</TableHead>
                <TableHead>{t("alerts.channels.columnConfig")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id}>
                  <TableCell className="font-medium">{channel.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {channel.type === 'email' ? <Mail className="h-3 w-3 mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                      {channel.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {channel.type === 'email' ? channel.config.email : channel.config.chatId}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={channel.enabled}
                      onCheckedChange={() => handleToggleChannel(channel.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleTestNotification(channel.id)}>
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setChannelToDelete({ id: channel.id, name: channel.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ConfirmDialog
          open={!!channelToDelete}
          onOpenChange={(open) => !open && setChannelToDelete(null)}
          title={t("alerts.channels.deleteTitle")}
          description={t("alerts.channels.deleteDesc", {
            name: channelToDelete?.name ?? "",
          })}
          confirmText={t("alerts.channels.deleteConfirm")}
          onConfirm={handleDeleteChannel}
          isLoading={deleteNotificationChannel.isPending}
          variant="destructive"
        />
      </CardContent>
    </Card>
  );
}

// Component for alert rules with suspense
function AlertRulesTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: channels } = useSuspenseNotificationChannels();
  const { data: alertRules } = useSuspenseAlertRules();
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);

  const createAlertRule = useCreateAlertRule();
  const updateAlertRule = useUpdateAlertRule();
  const deleteAlertRule = useDeleteAlertRule();

  // Helper function to generate condition based on alert type
  const getConditionForAlertType = (alertType: "cpu" | "memory" | "disk" | "upstream" | "ssl"): string => {
    switch (alertType) {
      case "cpu":
        return "cpu > threshold";
      case "memory":
        return "memory > threshold";
      case "disk":
        return "disk > threshold";
      case "upstream":
        return "upstream_status == down";
      case "ssl":
        return "ssl_days_remaining < threshold";
      default:
        return "cpu > threshold";
    }
  };

  const [ruleForm, setRuleForm] = useState({
    name: "",
    alertType: "cpu" as "cpu" | "memory" | "disk" | "upstream" | "ssl",
    condition: getConditionForAlertType("cpu"),
    threshold: 80,
    severity: "warning" as "critical" | "warning" | "info",
    channels: [] as string[],
    enabled: true,
    checkInterval: 60
  });

  const handleAddRule = async () => {
    try {
      await createAlertRule.mutateAsync(ruleForm);
      setIsRuleDialogOpen(false);
      resetRuleForm();
      toast({ title: t("alerts.rule.added") });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("alerts.rule.addFailed"),
        variant: "destructive",
      });
    }
  };

  const resetRuleForm = () => {
    setRuleForm({
      name: "",
      alertType: "cpu",
      condition: getConditionForAlertType("cpu"),
      threshold: 80,
      severity: "warning",
      channels: [],
      enabled: true,
      checkInterval: 60
    });
  };

  // Update condition and defaults based on alert type
  const handleAlertTypeChange = (type: "cpu" | "memory" | "disk" | "upstream" | "ssl") => {
    let threshold = 80;
    let checkInterval = 60;
    let defaultName = "";

    switch (type) {
      case "cpu":
        threshold = 80;
        checkInterval = 30;
        defaultName = t("alerts.rules.defaultName.cpu");
        break;
      case "memory":
        threshold = 85;
        checkInterval = 30;
        defaultName = t("alerts.rules.defaultName.memory");
        break;
      case "disk":
        threshold = 90;
        checkInterval = 300;
        defaultName = t("alerts.rules.defaultName.disk");
        break;
      case "upstream":
        threshold = 1;
        checkInterval = 60;
        defaultName = t("alerts.rules.defaultName.upstream");
        break;
      case "ssl":
        threshold = 30;
        checkInterval = 86400;
        defaultName = t("alerts.rules.defaultName.ssl");
        break;
    }

    setRuleForm({
      ...ruleForm,
      alertType: type,
      condition: getConditionForAlertType(type),
      threshold,
      checkInterval,
      name: ruleForm.name || defaultName,
    });
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete) return;

    try {
      await deleteAlertRule.mutateAsync(ruleToDelete.id);
      toast({ title: t("alerts.rule.deleted") });
      setRuleToDelete(null);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("alerts.rule.deleteFailed"),
        variant: "destructive",
      });
    }
  };

  const handleToggleRule = async (id: string) => {
    try {
      const rule = alertRules.find(r => r.id === id);
      if (!rule) return;

      await updateAlertRule.mutateAsync({
        id,
        data: { enabled: !rule.enabled }
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("alerts.rule.toggleFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t("alerts.rules.title")}</CardTitle>
          <CardDescription>{t("alerts.rules.desc")}</CardDescription>
        </div>
        <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("alerts.rules.add")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("alerts.rules.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("alerts.rules.dialogDesc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="alert-type">{t("alerts.rules.fieldAlertType")}</Label>
                <Select value={ruleForm.alertType} onValueChange={handleAlertTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpu">{t("alerts.rules.type.cpu")}</SelectItem>
                    <SelectItem value="memory">{t("alerts.rules.type.memory")}</SelectItem>
                    <SelectItem value="disk">{t("alerts.rules.type.disk")}</SelectItem>
                    <SelectItem value="upstream">{t("alerts.rules.type.upstream")}</SelectItem>
                    <SelectItem value="ssl">{t("alerts.rules.type.ssl")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {ruleForm.alertType === "cpu" && t("alerts.rules.hint.cpu")}
                  {ruleForm.alertType === "memory" && t("alerts.rules.hint.memory")}
                  {ruleForm.alertType === "disk" && t("alerts.rules.hint.disk")}
                  {ruleForm.alertType === "upstream" && t("alerts.rules.hint.upstream")}
                  {ruleForm.alertType === "ssl" && t("alerts.rules.hint.ssl")}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rule-name">{t("alerts.rules.fieldName")}</Label>
                <Input
                  id="rule-name"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder={t("alerts.rules.namePlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="condition">{t("alerts.rules.fieldCondition")}</Label>
                <Input
                  id="condition"
                  value={ruleForm.condition}
                  onChange={(e) => setRuleForm({ ...ruleForm, condition: e.target.value })}
                  placeholder={t("alerts.rules.conditionPlaceholder")}
                  disabled
                />
                <p className="text-xs text-muted-foreground">{t("alerts.rules.conditionHint")}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="threshold">
                    {ruleForm.alertType === "ssl"
                      ? t("alerts.rules.thresholdDays")
                      : t("alerts.rules.thresholdPercent")}
                  </Label>
                  <Input
                    id="threshold"
                    type="number"
                    value={ruleForm.threshold}
                    onChange={(e) => setRuleForm({ ...ruleForm, threshold: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {ruleForm.alertType === "ssl"
                      ? t("alerts.rules.thresholdHintDays")
                      : t("alerts.rules.thresholdHintPercent")}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="severity">{t("alerts.rules.fieldSeverity")}</Label>
                  <Select value={ruleForm.severity} onValueChange={(value: any) => setRuleForm({ ...ruleForm, severity: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">{t("alerts.rules.severity.info")}</SelectItem>
                      <SelectItem value="warning">{t("alerts.rules.severity.warning")}</SelectItem>
                      <SelectItem value="critical">{t("alerts.rules.severity.critical")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="checkInterval">{t("alerts.rules.checkInterval")}</Label>
                <Input
                  id="checkInterval"
                  type="number"
                  min="10"
                  max="86400"
                  value={ruleForm.checkInterval}
                  onChange={(e) => setRuleForm({ ...ruleForm, checkInterval: Number(e.target.value) })}
                  placeholder="60"
                />
                <p className="text-xs text-muted-foreground">
                  {ruleForm.alertType === "ssl"
                    ? t("alerts.rules.checkHintSsl")
                    : t("alerts.rules.checkHintGeneral")}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>{t("alerts.rules.fieldChannels")}</Label>
                <div className="space-y-2">
                  {channels.filter(c => c.enabled).map(channel => (
                    <div key={channel.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`channel-${channel.id}`}
                        checked={ruleForm.channels.includes(channel.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRuleForm({ ...ruleForm, channels: [...ruleForm.channels, channel.id] });
                          } else {
                            setRuleForm({ ...ruleForm, channels: ruleForm.channels.filter(c => c !== channel.id) });
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={`channel-${channel.id}`} className="font-normal">
                        {channel.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="rule-enabled"
                  checked={ruleForm.enabled}
                  onCheckedChange={(checked) => setRuleForm({ ...ruleForm, enabled: checked })}
                />
                <Label htmlFor="rule-enabled">{t("alerts.rules.enableRule")}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)} disabled={createAlertRule.isPending}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAddRule} disabled={createAlertRule.isPending}>
                {createAlertRule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("alerts.rules.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("alerts.rules.fieldCondition")}</TableHead>
                <TableHead>{t("alerts.rules.fieldSeverity")}</TableHead>
                <TableHead>{t("alerts.rules.fieldChannels")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {rule.condition} ({rule.threshold})
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      rule.severity === 'critical' ? 'destructive' :
                      rule.severity === 'warning' ? 'secondary' : 'default'
                    }>
                      {rule.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {rule.channels.map(chId => {
                        const channel = channels.find(c => c.id === chId);
                        return channel ? (
                          <Badge key={chId} variant="outline" className="text-xs">
                            {channel.type === 'email' ? <Mail className="h-2 w-2" /> : <MessageSquare className="h-2 w-2" />}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggleRule(rule.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setRuleToDelete({ id: rule.id, name: rule.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ConfirmDialog
          open={!!ruleToDelete}
          onOpenChange={(open) => !open && setRuleToDelete(null)}
          title={t("alerts.rules.deleteTitle")}
          description={t("alerts.rules.deleteDesc", { name: ruleToDelete?.name ?? "" })}
          confirmText={t("alerts.rules.deleteConfirm")}
          onConfirm={handleDeleteRule}
          isLoading={deleteAlertRule.isPending}
          variant="destructive"
        />
      </CardContent>
    </Card>
  );
}

// Main Alerts component
const Alerts = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("alerts.page.title")}</h1>
            <p className="text-muted-foreground">{t("alerts.page.subtitle")}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList>
          <TabsTrigger value="channels">{t("alerts.tab.channels")}</TabsTrigger>
          <TabsTrigger value="rules">{t("alerts.tab.rules")}</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-4">
          <Suspense fallback={<SkeletonTable rows={5} columns={5} title={t("alerts.channels.title")} />}>
            <NotificationChannelsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Suspense fallback={<SkeletonTable rows={5} columns={6} title={t("alerts.rules.title")} />}>
            <AlertRulesTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Alerts;
