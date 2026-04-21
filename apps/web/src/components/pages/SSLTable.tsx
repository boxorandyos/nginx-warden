import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseSSLCertificates } from '@/queries/ssl.query-options';
import { useRenewSSLCertificate, useDeleteSSLCertificate } from '@/queries/ssl.query-options';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function SSLTable() {
  const { t, i18n } = useTranslation();
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const { data: certificates } = useSuspenseSSLCertificates();
  const renewMutation = useRenewSSLCertificate();
  const deleteMutation = useDeleteSSLCertificate();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    certificateId: string;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
    certificateId: '',
  });

  const handleRenew = async (id: string, daysUntilExpiry?: number) => {
    try {
      setRenewingId(id);
      
      // Check if certificate is eligible for renewal
      if (daysUntilExpiry !== undefined && daysUntilExpiry > 30) {
        toast.warning(t('ssl.table.renewNotEligible', { days: daysUntilExpiry }));
        setRenewingId(null);
        return;
      }
      
      await renewMutation.mutateAsync(id);
      toast.success(t('ssl.table.renewSuccess'));
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || t('ssl.table.renewFailed');
      
      // Check if error is about eligibility
      if (errorMessage.includes('not yet eligible') || errorMessage.includes('less than 30 days')) {
        toast.warning(errorMessage);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setRenewingId(null);
    }
  };

  const handleDelete = (id: string, domainName: string) => {
    setConfirmDialog({
      open: true,
      title: t('ssl.dialog.deleteTitle'),
      description: t('ssl.dialog.deleteDescription', { domain: domainName }),
      certificateId: id,
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(id);
          toast.success(t('ssl.table.deleteSuccess'));
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error: any) {
          toast.error(error.response?.data?.message || t('ssl.table.deleteFailed'));
        }
      },
    });
  };

  const getStatusIcon = (status: string) => {
    if (status === 'valid') {
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      valid: 'default' as const,
      expiring: 'default' as const,
      expired: 'destructive' as const
    };
    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('ssl.table.cardTitle')}</CardTitle>
        <CardDescription>
          {t('ssl.table.cardDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {certificates.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">
              {t('ssl.table.empty')}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('ssl.table.emptyHint')}
            </div>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ssl.table.column.domain')}</TableHead>
                  <TableHead>{t('ssl.table.column.issuer')}</TableHead>
                  <TableHead>{t('ssl.table.column.validFrom')}</TableHead>
                  <TableHead>{t('ssl.table.column.validTo')}</TableHead>
                  <TableHead>{t('ssl.table.column.autoRenew')}</TableHead>
                  <TableHead>{t('ssl.table.column.status')}</TableHead>
                  <TableHead className="text-right">{t('ssl.table.column.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(cert.status)}
                        {cert.domain?.name || cert.commonName}
                      </div>
                    </TableCell>
                    <TableCell>{cert.issuer}</TableCell>
                    <TableCell>{formatDate(cert.validFrom)}</TableCell>
                    <TableCell>{formatDate(cert.validTo)}</TableCell>
                    <TableCell>
                      <Badge variant={cert.autoRenew ? 'default' : 'secondary'}>
                        {cert.autoRenew ? t('ssl.table.autoRenewOn') : t('ssl.table.autoRenewOff')}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(cert.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {(cert.issuer === "Let's Encrypt" || cert.issuer === "ZeroSSL") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRenew(cert.id, cert.daysUntilExpiry)}
                            disabled={renewingId === cert.id}
                            title={
                              cert.daysUntilExpiry !== undefined && cert.daysUntilExpiry > 30
                                ? t('ssl.table.renewTitleEarly', { days: cert.daysUntilExpiry })
                                : t('ssl.table.renewTitle')
                            }
                          >
                            {renewingId === cert.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                {t('ssl.table.renew')}
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(cert.id, cert.domain?.name || cert.commonName)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText={t('common.delete')}
        isLoading={deleteMutation.isPending}
      />
    </Card>
  );
}