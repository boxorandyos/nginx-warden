import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useAuth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { systemConfigService } from '@/services/system-config.service';
import { systemConfigQueryOptions } from '@/queries/system-config.query-options';

/**
 * Let's Encrypt / ZeroSSL defaults + ZeroSSL EAB credentials.
 * Shown on SSL and Configuration so EAB is discoverable where certs are managed.
 */
export function AcmeSettingsCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(systemConfigQueryOptions.all);
  const config = data?.data;

  const [acmeProvider, setAcmeProvider] = useState<'letsencrypt' | 'zerossl'>('letsencrypt');
  const [eabKid, setEabKid] = useState('');
  const [eabHmac, setEabHmac] = useState('');

  useEffect(() => {
    if (config?.acmeDefaultProvider === 'zerossl') {
      setAcmeProvider('zerossl');
    } else if (config?.acmeDefaultProvider) {
      setAcmeProvider('letsencrypt');
    }
  }, [config?.acmeDefaultProvider]);

  const acmeMutation = useMutation({
    mutationFn: () =>
      systemConfigService.updateAcme({
        acmeDefaultProvider: acmeProvider,
        zerosslEabKid: eabKid.trim() || undefined,
        zerosslEabHmacKey: eabHmac.trim() || undefined,
      }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('configuration.acme.toastSaved'));
        setEabHmac('');
        queryClient.invalidateQueries({ queryKey: ['system-config'] });
      } else {
        toast.error(res.message || t('configuration.acme.toastFailed'));
      }
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('configuration.acme.toastFailed'));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('configuration.acme.title')}</CardTitle>
        <CardDescription>{t('configuration.acme.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t('configuration.acme.defaultProvider')}</Label>
          <Select
            value={acmeProvider}
            onValueChange={(v) => setAcmeProvider(v as 'letsencrypt' | 'zerossl')}
            disabled={!isAdmin || isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="letsencrypt">Let's Encrypt</SelectItem>
              <SelectItem value="zerossl">ZeroSSL</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t('configuration.acme.defaultProviderHint')}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="zerossl-eab-kid-ssl">{t('configuration.acme.eabKid')}</Label>
          <Input
            id="zerossl-eab-kid-ssl"
            value={eabKid}
            onChange={(e) => setEabKid(e.target.value)}
            placeholder={
              config?.zerosslEabConfigured
                ? t('configuration.acme.eabConfigured')
                : t('configuration.acme.eabKidPlaceholder')
            }
            disabled={!isAdmin || isLoading}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zerossl-eab-hmac-ssl">{t('configuration.acme.eabHmac')}</Label>
          <Input
            id="zerossl-eab-hmac-ssl"
            type="password"
            value={eabHmac}
            onChange={(e) => setEabHmac(e.target.value)}
            placeholder={t('configuration.acme.eabHmacPlaceholder')}
            disabled={!isAdmin || isLoading}
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">{t('configuration.acme.eabHint')}</p>
        </div>
        <Button
          type="button"
          onClick={() => acmeMutation.mutate()}
          disabled={!isAdmin || acmeMutation.isPending || isLoading}
        >
          {acmeMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t('configuration.acme.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
