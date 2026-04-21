import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CustomRuleDialog } from '@/components/modsec/CustomRuleDialog';
import { toast } from 'sonner';
import {
  useCrsRules,
  useModSecRules,
  useGlobalModSecSettings,
  useToggleCrsRule,
  useToggleModSecRule,
  useSetGlobalModSec,
  useDeleteModSecRule,
} from '@/queries/modsec.query-options';
import type { ModSecurityCustomRule } from '@/types';

export default function ModSecurity() {
  const { t } = useTranslation();
  const [customRuleDialogOpen, setCustomRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ModSecurityCustomRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  
  // Queries
  const { data: crsRules = [] } = useCrsRules();
  const { data: customRules = [] } = useModSecRules();
  const { data: globalSettings } = useGlobalModSecSettings();
  
  // Mutations
  const toggleCrsRuleMutation = useToggleCrsRule();
  const toggleCustomRuleMutation = useToggleModSecRule();
  const setGlobalModSecMutation = useSetGlobalModSec();
  const deleteCustomRuleMutation = useDeleteModSecRule();
  
  const globalModSecEnabled = globalSettings?.enabled ?? true;

  const handleGlobalToggle = async (enabled: boolean) => {
    try {
      await setGlobalModSecMutation.mutateAsync(enabled);
      toast.success(t('modsec.toast.global', { state: enabled ? t('modsec.state.enabled') : t('modsec.state.disabled') }));
    } catch (error) {
      toast.error(t('modsec.toast.globalFailed'));
    }
  };

  const handleCRSRuleToggle = async (ruleFile: string, name: string, currentState: boolean) => {
    try {
      await toggleCrsRuleMutation.mutateAsync({ ruleFile });
      toast.success(
        t('modsec.toast.ruleToggled', {
          name,
          state: !currentState ? t('modsec.state.enabled') : t('modsec.state.disabled'),
        })
      );
    } catch (error) {
      toast.error(t('modsec.toast.ruleToggleFailed'));
    }
  };

  const handleCustomRuleToggle = async (id: string, name: string, currentState: boolean) => {
    try {
      await toggleCustomRuleMutation.mutateAsync(id);
      toast.success(
        t('modsec.toast.ruleToggled', {
          name,
          state: !currentState ? t('modsec.state.enabled') : t('modsec.state.disabled'),
        })
      );
    } catch (error) {
      toast.error(t('modsec.toast.ruleToggleFailed'));
    }
  };

  const handleEditRule = (rule: ModSecurityCustomRule) => {
    setEditingRule(rule);
    setCustomRuleDialogOpen(true);
  };

  const handleDeleteRule = async () => {
    if (!deletingRuleId) return;

    try {
      await deleteCustomRuleMutation.mutateAsync(deletingRuleId);
      toast.success(t('modsec.toast.ruleDeleted'));
      setDeletingRuleId(null);
    } catch (error) {
      toast.error(t('modsec.toast.ruleDeleteFailed'));
    }
  };

  const handleDialogClose = (open: boolean) => {
    setCustomRuleDialogOpen(open);
    if (!open) {
      setEditingRule(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('modsec.title')}</h1>
          <p className="text-muted-foreground">{t('modsec.subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('modsec.global')}</CardTitle>
          <CardDescription>
            {t('modsec.globalDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="global-modsec" className="text-base">
                {t('modsec.protectionLabel')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {globalModSecEnabled
                  ? t('modsec.protectionOnHelp')
                  : t('modsec.protectionOffHelp')}
              </p>
            </div>
            <Switch
              id="global-modsec"
              checked={globalModSecEnabled}
              onCheckedChange={handleGlobalToggle}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('modsec.rulesCardTitle')}</CardTitle>
          <CardDescription>
            {t('modsec.rulesCardDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="crs" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="crs">{t('modsec.tabCrs')}</TabsTrigger>
              <TabsTrigger value="custom">{t('modsec.tabCustom')}</TabsTrigger>
            </TabsList>

            <TabsContent value="crs" className="mt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('modsec.table.ruleName')}</TableHead>
                      <TableHead>{t('modsec.table.category')}</TableHead>
                      <TableHead>{t('modsec.table.description')}</TableHead>
                      <TableHead>{t('modsec.table.status')}</TableHead>
                      <TableHead className="text-right">{t('modsec.table.enable')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crsRules.map((rule) => (
                      <TableRow key={rule.ruleFile}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {rule.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                            {rule.enabled ? t('modsec.label.enabled') : t('modsec.label.disabled')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => handleCRSRuleToggle(rule.ruleFile, rule.name, rule.enabled)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="mt-6">
              <div className="flex justify-end mb-4">
                <Button onClick={() => setCustomRuleDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('modsec.addCustomRule')}
                </Button>
              </div>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('modsec.table.ruleName')}</TableHead>
                      <TableHead>{t('modsec.table.category')}</TableHead>
                      <TableHead>{t('modsec.table.description')}</TableHead>
                      <TableHead>{t('modsec.table.status')}</TableHead>
                      <TableHead className="text-right">{t('modsec.table.enable')}</TableHead>
                      <TableHead className="text-right">{t('modsec.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customRules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {t('modsec.emptyCustom')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      customRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">{rule.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{rule.category}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {rule.description}
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                              {rule.enabled ? t('modsec.label.enabled') : t('modsec.label.disabled')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={() => handleCustomRuleToggle(rule.id, rule.name, rule.enabled)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRule(rule)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingRuleId(rule.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CustomRuleDialog
        open={customRuleDialogOpen}
        onOpenChange={handleDialogClose}
        editRule={editingRule}
      />

      <AlertDialog open={!!deletingRuleId} onOpenChange={(open) => !open && setDeletingRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modsec.deleteRuleTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modsec.deleteRuleDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
