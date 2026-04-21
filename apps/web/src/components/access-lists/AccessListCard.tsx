import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, Trash2, Globe, Shield, ShieldCheck, Power } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { useToast } from '@/hooks/use-toast';
import { useDeleteAccessList, useToggleAccessList } from '@/queries/access-lists.query-options';
import { AccessListFormDialog } from './AccessListFormDialog';
import type { AccessList } from '@/services/access-lists.service';

interface AccessListCardProps {
  accessList: AccessList;
}

export function AccessListCard({ accessList }: AccessListCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const deleteMutation = useDeleteAccessList();
  const toggleMutation = useToggleAccessList();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(accessList.id);
      toast({
        title: t('common.success'),
        description: t('accessLists.toast.deleteSuccess'),
      });
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.message || t('accessLists.toast.deleteFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id: accessList.id, enabled });
      toast({
        title: t('common.success'),
        description: t('accessLists.toast.toggleSuccess', {
          state: t(enabled ? 'accessLists.state.enabled' : 'accessLists.state.disabled'),
        }),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.message || t('accessLists.toast.toggleFailed'),
        variant: 'destructive',
      });
    }
  };

  const getTypeIcon = () => {
    switch (accessList.type) {
      case 'ip_whitelist':
        return <Shield className="h-4 w-4" />;
      case 'http_basic_auth':
        return <ShieldCheck className="h-4 w-4" />;
      case 'combined':
        return <Power className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (accessList.type) {
      case 'ip_whitelist':
        return t('accessLists.type.ipWhitelist');
      case 'http_basic_auth':
        return t('accessLists.type.httpBasic');
      case 'combined':
        return t('accessLists.type.combined');
      default:
        return accessList.type;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-lg">{accessList.name}</CardTitle>
                <Badge variant={accessList.enabled ? 'default' : 'secondary'}>
                  {accessList.enabled ? t('accessLists.status.enabled') : t('accessLists.status.disabled')}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  {getTypeIcon()}
                  {getTypeLabel()}
                </Badge>
              </div>
              {accessList.description && (
                <p className="text-sm text-muted-foreground">{accessList.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={accessList.enabled}
                onCheckedChange={handleToggle}
                disabled={toggleMutation.isPending}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(accessList.type === 'ip_whitelist' || accessList.type === 'combined') && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('accessLists.card.allowedIps')}</h4>
                <div className="flex flex-wrap gap-1">
                  {accessList.allowedIps && accessList.allowedIps.length > 0 ? (
                    accessList.allowedIps.slice(0, 3).map((ip, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {ip}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('accessLists.card.noIps')}</p>
                  )}
                  {accessList.allowedIps && accessList.allowedIps.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      {t('accessLists.card.more', { count: accessList.allowedIps.length - 3 })}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {(accessList.type === 'http_basic_auth' || accessList.type === 'combined') && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('accessLists.card.authUsers')}</h4>
                <div className="flex flex-wrap gap-1">
                  {accessList.authUsers && accessList.authUsers.length > 0 ? (
                    accessList.authUsers.slice(0, 3).map((user) => (
                      <Badge key={user.id} variant="secondary" className="text-xs">
                        {user.username}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('accessLists.card.noUsers')}</p>
                  )}
                  {accessList.authUsers && accessList.authUsers.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      {t('accessLists.card.more', { count: accessList.authUsers.length - 3 })}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {t('accessLists.card.assignedDomains')}
              </h4>
              <div className="flex flex-wrap gap-1">
                {accessList.domains && accessList.domains.length > 0 ? (
                  accessList.domains.slice(0, 3).map((domainLink) => (
                    <Badge key={domainLink.id} variant="outline" className="text-xs">
                      {domainLink.domain.name}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t('accessLists.card.noDomains')}</p>
                )}
                {accessList.domains && accessList.domains.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    {t('accessLists.card.more', { count: accessList.domains.length - 3 })}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AccessListFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        accessList={accessList}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('accessLists.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('accessLists.deleteDesc', { name: accessList.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t('accessLists.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
