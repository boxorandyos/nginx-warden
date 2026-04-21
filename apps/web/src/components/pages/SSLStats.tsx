import { useTranslation } from 'react-i18next';
import { useSuspenseSSLCertificates } from '@/queries/ssl.query-options';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react';

export function SSLStats() {
  const { t } = useTranslation();
  const { data: certificates } = useSuspenseSSLCertificates();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('sslStats.totalCertificates')}</CardTitle>
          <Lock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{certificates.length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('sslStats.valid')}</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {certificates.filter(c => c.status === 'valid').length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('sslStats.expiringSoon')}</CardTitle>
          <AlertTriangle className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {certificates.filter(c => c.status === 'expiring').length}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
