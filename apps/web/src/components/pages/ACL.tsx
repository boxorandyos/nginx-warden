import { useState, useEffect } from "react";
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
import { Plus, Download, Upload, Trash2, Edit, Loader2, UserCog, AlertCircle, CheckCircle2, Info, FileCode } from "lucide-react";
import { ACLRule } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { SkeletonTable } from "@/components/ui/skeletons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateAclValue, getAclHintKey, getExampleValue } from "@/utils/acl-validators";
import { PreviewConfigDialog } from "@/components/acl/PreviewConfigDialog";
import {
  useSuspenseAclRules,
  useCreateAclRule,
  useUpdateAclRule,
  useDeleteAclRule,
  useToggleAclRule,
  useApplyAclRules
} from "@/queries";

// Component for ACL rules table with suspense
function AclRulesTable() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: rules } = useSuspenseAclRules();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ACLRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const createAclRule = useCreateAclRule();
  const updateAclRule = useUpdateAclRule();
  const deleteAclRule = useDeleteAclRule();
  const toggleAclRule = useToggleAclRule();
  const applyAclRules = useApplyAclRules();

  const [formData, setFormData] = useState({
    name: "",
    type: "blacklist" as "whitelist" | "blacklist",
    field: "ip" as "ip" | "geoip" | "user-agent" | "url" | "method" | "header",
    operator: "equals" as "equals" | "contains" | "regex",
    value: "",
    action: "deny" as "allow" | "deny" | "challenge",
    enabled: true
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);

  // Real-time validation when value changes
  useEffect(() => {
    if (formData.value.trim().length === 0) {
      setValidationError(null);
      setValidationSuccess(false);
      return;
    }

    const result = validateAclValue(formData.field, formData.operator, formData.value);
    if (result.valid) {
      setValidationError(null);
      setValidationSuccess(true);
    } else {
      setValidationError(
        t(result.errorKey, result.errorParams as Record<string, string> | undefined)
      );
      setValidationSuccess(false);
    }
  }, [formData.value, formData.field, formData.operator, t]);

  // Auto-adjust action based on type
  useEffect(() => {
    if (formData.type === 'whitelist' && formData.action === 'deny') {
      setFormData(prev => ({ ...prev, action: 'allow' }));
    } else if (formData.type === 'blacklist' && formData.action === 'allow') {
      setFormData(prev => ({ ...prev, action: 'deny' }));
    }
  }, [formData.type]);

  // Reset validation when field or operator changes
  useEffect(() => {
    setValidationError(null);
    setValidationSuccess(false);
    if (formData.value.trim().length > 0) {
      const result = validateAclValue(formData.field, formData.operator, formData.value);
      if (result.valid) {
        setValidationSuccess(true);
      } else {
        setValidationError(
          t(result.errorKey, result.errorParams as Record<string, string> | undefined)
        );
      }
    }
  }, [formData.field, formData.operator, formData.value, t]);

  const handleAddRule = async () => {
    // Validate before submission
    if (!formData.name.trim()) {
      toast({
        title: t("common.validationError"),
        description: t("acl.toast.nameRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.value.trim()) {
      toast({
        title: t("common.validationError"),
        description: t("acl.toast.valueRequired"),
        variant: "destructive",
      });
      return;
    }

    const valueValidation = validateAclValue(formData.field, formData.operator, formData.value);
    if (!valueValidation.valid) {
      toast({
        title: t("common.validationError"),
        description: t(
          valueValidation.errorKey,
          valueValidation.errorParams as Record<string, string> | undefined
        ),
        variant: "destructive",
      });
      return;
    }

    // Transform field format: user-agent -> user_agent for backend
    const conditionField = formData.field.replace('-', '_') as any;

    try {
      if (editingRule) {
        await updateAclRule.mutateAsync({
          id: editingRule.id,
          data: {
            name: formData.name,
            type: formData.type,
            conditionField,
            conditionOperator: formData.operator,
            conditionValue: formData.value,
            action: formData.action,
            enabled: formData.enabled
          }
        });
        toast({ title: t("acl.toast.updateSuccess") });
      } else {
        await createAclRule.mutateAsync({
          name: formData.name,
          type: formData.type,
          conditionField,
          conditionOperator: formData.operator,
          conditionValue: formData.value,
          action: formData.action,
          enabled: formData.enabled
        });
        toast({ title: t("acl.toast.addSuccess") });
      }

      setIsDialogOpen(false);
      setEditingRule(null);
      resetForm();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("acl.toast.saveFailed"),
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "blacklist",
      field: "ip",
      operator: "equals",
      value: "",
      action: "deny",
      enabled: true
    });
    setValidationError(null);
    setValidationSuccess(false);
  };

  const handleEdit = (rule: ACLRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      field: rule.condition.field,
      operator: rule.condition.operator,
      value: rule.condition.value,
      action: rule.action,
      enabled: rule.enabled
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;

    try {
      await deleteAclRule.mutateAsync(ruleToDelete.id);
      toast({ title: t("acl.toast.deleteSuccess") });
      setRuleToDelete(null);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("acl.toast.deleteFailed"),
        variant: "destructive",
      });
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleAclRule.mutateAsync(id);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("acl.toast.toggleFailed"),
        variant: "destructive",
      });
    }
  };

  const handleApplyRules = async () => {
    try {
      const result = await applyAclRules.mutateAsync();
      toast({
        title: result.success ? t("common.success") : t("common.error"),
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: t("acl.toast.applyError"),
        description: error.response?.data?.message || t("acl.toast.applyFailed"),
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(rules, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `acl-rules-${new Date().toISOString()}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast({ title: t("acl.toast.exported") });
  };

  const handleImport = () => {
    toast({ title: t("acl.toast.importMock"), description: t("acl.toast.importMockDesc") });
  };

  const actionLabel = (a: string) =>
    a === "allow"
      ? t("acl.action.allow")
      : a === "deny"
        ? t("acl.action.deny")
        : t("acl.action.challenge");

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <UserCog className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("acl.page.title")}</h1>
            <p className="text-muted-foreground">{t("acl.page.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <FileCode className="h-4 w-4 mr-2" />
            {t("acl.previewConfig")}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleApplyRules} disabled={applyAclRules.isPending}>
            {applyAclRules.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("acl.applyNginx")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            {t("acl.import")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t("acl.export")}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingRule(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("acl.addRule")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? t("acl.dialog.editTitle") : t("acl.dialog.addTitle")}
                </DialogTitle>
                <DialogDescription>{t("acl.dialog.desc")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("acl.field.ruleName")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("acl.placeholder.ruleName")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">{t("acl.field.type")}</Label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whitelist">{t("acl.type.whitelist")}</SelectItem>
                        <SelectItem value="blacklist">{t("acl.type.blacklist")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="action">{t("acl.field.action")}</Label>
                    <Select value={formData.action} onValueChange={(value: any) => setFormData({ ...formData, action: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">{t("acl.action.allow")}</SelectItem>
                        <SelectItem value="deny">{t("acl.action.deny")}</SelectItem>
                        <SelectItem value="challenge">{t("acl.action.challenge")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="field">{t("acl.field.field")}</Label>
                    <Select value={formData.field} onValueChange={(value: any) => setFormData({ ...formData, field: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ip">{t("acl.field.ip")}</SelectItem>
                        <SelectItem value="geoip">{t("acl.field.geoip")}</SelectItem>
                        <SelectItem value="user-agent">{t("acl.field.userAgent")}</SelectItem>
                        <SelectItem value="url">{t("acl.field.url")}</SelectItem>
                        <SelectItem value="method">{t("acl.field.method")}</SelectItem>
                        <SelectItem value="header">{t("acl.field.header")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="operator">{t("acl.field.operator")}</Label>
                    <Select value={formData.operator} onValueChange={(value: any) => setFormData({ ...formData, operator: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">{t("acl.op.equals")}</SelectItem>
                        <SelectItem value="contains">{t("acl.op.contains")}</SelectItem>
                        <SelectItem value="regex">{t("acl.op.regex")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="value">{t("acl.field.value")}</Label>
                    <div className="relative">
                      <Input
                        id="value"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        placeholder={getExampleValue(formData.field, formData.operator)}
                        className={validationError ? 'border-red-500' : validationSuccess ? 'border-green-500' : ''}
                      />
                      {validationSuccess && formData.value.trim().length > 0 && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                      {validationError && (
                        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Validation feedback */}
                {validationError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}
                
                {/* Hints */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{t("acl.hintLabel")}:</strong>{" "}
                    {t(getAclHintKey(formData.field, formData.operator))}
                  </AlertDescription>
                </Alert>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label htmlFor="enabled">{t("acl.enableRule")}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={createAclRule.isPending || updateAclRule.isPending}>
                  {t("common.cancel")}
                </Button>
                <Button 
                  onClick={handleAddRule} 
                  disabled={
                    createAclRule.isPending || 
                    updateAclRule.isPending || 
                    !formData.name.trim() || 
                    !formData.value.trim() || 
                    !!validationError
                  }
                >
                  {(createAclRule.isPending || updateAclRule.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingRule ? t("acl.submit.update") : t("acl.submit.add")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("acl.rulesCount", { count: rules.length })}</CardTitle>
          <CardDescription>{t("acl.rulesDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("acl.table.name")}</TableHead>
                  <TableHead>{t("acl.table.type")}</TableHead>
                  <TableHead>{t("acl.table.condition")}</TableHead>
                  <TableHead>{t("acl.table.action")}</TableHead>
                  <TableHead>{t("acl.table.status")}</TableHead>
                  <TableHead className="text-right">{t("acl.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant={rule.type === 'whitelist' ? 'default' : 'destructive'}>
                        {rule.type === "whitelist"
                          ? t("acl.type.whitelist")
                          : t("acl.type.blacklist")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {rule.condition.field} {rule.condition.operator} "{rule.condition.value}"
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        rule.action === 'allow' ? 'default' :
                        rule.action === 'deny' ? 'destructive' : 'secondary'
                      }>
                        {actionLabel(rule.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => handleToggle(rule.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
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
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!ruleToDelete}
        onOpenChange={(open) => !open && setRuleToDelete(null)}
        onConfirm={handleDelete}
        title={t("acl.deleteTitle")}
        description={t("acl.deleteDesc", { name: ruleToDelete?.name ?? "" })}
        confirmText={t("common.delete")}
        variant="destructive"
      />

      <PreviewConfigDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}

// Main ACL component
const ACL = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Suspense fallback={<SkeletonTable rows={8} columns={6} title={t("acl.skeletonTableTitle")} />}>
        <AclRulesTable />
      </Suspense>
    </div>
  );
};

export default ACL;
