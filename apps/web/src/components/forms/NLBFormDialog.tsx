import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useCreateNLB, useUpdateNLB } from '@/queries/nlb.query-options';
import { NetworkLoadBalancer, CreateNLBInput } from '@/types';
import {
  validateNLBConfig,
  isValidNLBName,
  validateUpstreamHost,
  getValidationHintKey,
  getExampleValueKey,
  checkConfigurationWarnings,
  type ConfigWarning,
} from '@/utils/nlb-validators';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, HelpCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface NLBFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  nlb?: NetworkLoadBalancer | null;
  mode: 'create' | 'edit';
}

type FormData = CreateNLBInput;

export default function NLBFormDialog({ isOpen, onClose, nlb, mode }: NLBFormDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const createMutation = useCreateNLB();
  const updateMutation = useUpdateNLB();
  const [configWarnings, setConfigWarnings] = useState<ConfigWarning[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      description: '',
      port: 10000,
      protocol: 'tcp',
      algorithm: 'round_robin',
      upstreams: [{ host: '', port: 80, weight: 1, maxFails: 3, failTimeout: 10, maxConns: 0, backup: false, down: false }],
      proxyTimeout: 3,
      proxyConnectTimeout: 1,
      proxyNextUpstream: true,
      proxyNextUpstreamTimeout: 0,
      proxyNextUpstreamTries: 0,
      healthCheckEnabled: true,
      healthCheckInterval: 10,
      healthCheckTimeout: 5,
      healthCheckRises: 2,
      healthCheckFalls: 3,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'upstreams',
  });

  const protocol = watch('protocol');
  const upstreams = watch('upstreams');
  const proxyTimeout = watch('proxyTimeout');
  const proxyConnectTimeout = watch('proxyConnectTimeout');
  const healthCheckEnabled = watch('healthCheckEnabled');
  const healthCheckInterval = watch('healthCheckInterval');
  const healthCheckTimeout = watch('healthCheckTimeout');

  // Check for configuration warnings whenever form values change
  useEffect(() => {
    if (upstreams && upstreams.length > 0) {
      const warnings = checkConfigurationWarnings({
        upstreams: upstreams,
        proxyTimeout: proxyTimeout || 3,
        proxyConnectTimeout: proxyConnectTimeout || 1,
        healthCheckEnabled: healthCheckEnabled || false,
        healthCheckInterval: healthCheckInterval,
        healthCheckTimeout: healthCheckTimeout,
      });
      setConfigWarnings(warnings);
    }
  }, [upstreams, proxyTimeout, proxyConnectTimeout, healthCheckEnabled, healthCheckInterval, healthCheckTimeout]);

  useEffect(() => {
    if (isOpen && nlb && mode === 'edit') {
      reset({
        name: nlb.name,
        description: nlb.description || '',
        port: nlb.port,
        protocol: nlb.protocol,
        algorithm: nlb.algorithm,
        upstreams: nlb.upstreams.map(u => ({
          host: u.host,
          port: u.port,
          weight: u.weight,
          maxFails: u.maxFails,
          failTimeout: u.failTimeout,
          maxConns: u.maxConns,
          backup: u.backup,
          down: u.down,
        })),
        proxyTimeout: nlb.proxyTimeout,
        proxyConnectTimeout: nlb.proxyConnectTimeout,
        proxyNextUpstream: nlb.proxyNextUpstream,
        proxyNextUpstreamTimeout: nlb.proxyNextUpstreamTimeout,
        proxyNextUpstreamTries: nlb.proxyNextUpstreamTries,
        healthCheckEnabled: nlb.healthCheckEnabled,
        healthCheckInterval: nlb.healthCheckInterval,
        healthCheckTimeout: nlb.healthCheckTimeout,
        healthCheckRises: nlb.healthCheckRises,
        healthCheckFalls: nlb.healthCheckFalls,
      });
    } else if (isOpen && mode === 'create') {
      reset({
        name: '',
        description: '',
        port: 10000,
        protocol: 'tcp',
        algorithm: 'round_robin',
        upstreams: [{ host: '', port: 80, weight: 1, maxFails: 3, failTimeout: 10, maxConns: 0, backup: false, down: false }],
        proxyTimeout: 3,
        proxyConnectTimeout: 1,
        proxyNextUpstream: true,
        proxyNextUpstreamTimeout: 0,
        proxyNextUpstreamTries: 0,
        healthCheckEnabled: true,
        healthCheckInterval: 10,
        healthCheckTimeout: 5,
        healthCheckRises: 2,
        healthCheckFalls: 3,
      });
    }
  }, [isOpen, nlb, mode, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      // Validate complete configuration before submission
      const validation = validateNLBConfig({
        name: data.name,
        port: Number(data.port),
        upstreams: data.upstreams.map(u => ({
          host: u.host,
          port: Number(u.port),
          weight: Number(u.weight),
          maxFails: Number(u.maxFails),
          failTimeout: Number(u.failTimeout),
          maxConns: Number(u.maxConns),
          backup: Boolean(u.backup),
          down: Boolean(u.down),
        })),
        proxyTimeout: Number(data.proxyTimeout),
        proxyConnectTimeout: Number(data.proxyConnectTimeout),
        proxyNextUpstreamTimeout: Number(data.proxyNextUpstreamTimeout),
        proxyNextUpstreamTries: Number(data.proxyNextUpstreamTries),
        healthCheckEnabled: Boolean(data.healthCheckEnabled),
        healthCheckInterval: Number(data.healthCheckInterval),
        healthCheckTimeout: Number(data.healthCheckTimeout),
        healthCheckRises: Number(data.healthCheckRises),
        healthCheckFalls: Number(data.healthCheckFalls),
      });

      if (!validation.valid) {
        const errorMessages = Object.entries(validation.errors).map(([field, issue]) => {
          const label = t(`nlbForm.fields.${field}`);
          return `${label}: ${t(issue.key, issue.values as Record<string, string | number>)}`;
        });
        
        setValidationErrors(errorMessages);
        
        toast({
          title: t('nlbForm.toast.validationTitle'),
          description: t('nlbForm.toast.validationDetail', { count: errorMessages.length }),
          variant: 'destructive',
        });
        return;
      }

      // Clear validation errors if everything is valid
      setValidationErrors([]);

      // Convert all string numbers to actual numbers
      const processedData = {
        ...data,
        port: Number(data.port),
        proxyTimeout: Number(data.proxyTimeout),
        proxyConnectTimeout: Number(data.proxyConnectTimeout),
        proxyNextUpstream: Boolean(data.proxyNextUpstream),
        proxyNextUpstreamTimeout: Number(data.proxyNextUpstreamTimeout),
        proxyNextUpstreamTries: Number(data.proxyNextUpstreamTries),
        healthCheckEnabled: Boolean(data.healthCheckEnabled),
        healthCheckInterval: Number(data.healthCheckInterval),
        healthCheckTimeout: Number(data.healthCheckTimeout),
        healthCheckRises: Number(data.healthCheckRises),
        healthCheckFalls: Number(data.healthCheckFalls),
        upstreams: data.upstreams.map(upstream => ({
          ...upstream,
          port: Number(upstream.port),
          weight: Number(upstream.weight),
          maxFails: Number(upstream.maxFails),
          failTimeout: Number(upstream.failTimeout),
          maxConns: Number(upstream.maxConns),
          backup: Boolean(upstream.backup),
          down: Boolean(upstream.down),
        })),
      };

      if (mode === 'create') {
        await createMutation.mutateAsync(processedData);
        toast({
          title: t('common.success'),
          description: t('nlbForm.toast.createSuccess'),
        });
      } else if (nlb) {
        await updateMutation.mutateAsync({ id: nlb.id, data: processedData });
        toast({
          title: t('common.success'),
          description: t('nlbForm.toast.updateSuccess'),
        });
      }
      onClose();
    } catch (error: any) {
      console.error('NLB submission error:', error);

      const response = error.response?.data;
      let errorMessages: string[] = [];
      let isValidationError = false;

      if (response?.errors && Array.isArray(response.errors)) {
        isValidationError = true;
        errorMessages = response.errors.map((err: any) => {
          if (err.msg && err.path) {
            return `${err.path}: ${err.msg}`;
          }
          return err.msg || err.message || t('common.unknownError');
        });
        setValidationErrors(errorMessages);
      } else if (response?.message) {
        if (response.message.includes('already exists')) {
          errorMessages = [t('nlbForm.toast.errNameExists')];
        } else if (response.message.includes('host not found') || response.message.includes('Invalid host')) {
          errorMessages = [t('nlbForm.toast.errInvalidHost')];
        } else if (response.message.includes('nginx')) {
          errorMessages = [t('nlbForm.toast.errNginx', { message: response.message })];
        } else {
          errorMessages = [response.message];
        }
        setValidationErrors(errorMessages);
      } else {
        errorMessages = [t('nlbForm.toast.saveFailedGeneric')];
      }

      toast({
        title: isValidationError ? t('common.validationError') : t('common.error'),
        description: errorMessages[0] || t('nlbForm.toast.saveFailed'),
        variant: 'destructive',
      });
    }
  };

  const addUpstream = () => {
    append({ host: '', port: 80, weight: 1, maxFails: 3, failTimeout: 10, maxConns: 0, backup: false, down: false });
  };

  // Clear validation errors when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setValidationErrors([]);
      setConfigWarnings([]);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('nlbForm.title.create') : t('nlbForm.title.edit')}
          </DialogTitle>
          <DialogDescription>{t('nlbForm.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Validation Errors Alert */}
          {validationErrors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-800 mb-2">
                    {t('nlbForm.errorsHeading', { count: validationErrors.length })}
                  </h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {validationErrors.map((error, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-red-600 font-bold">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-600 mt-2">{t('nlbForm.fixBeforeSubmit')}</p>
                </div>
              </div>
            </div>
          )}

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">{t('nlbForm.tab.basic')}</TabsTrigger>
              <TabsTrigger value="upstreams">{t('nlbForm.tab.upstreams')}</TabsTrigger>
              <TabsTrigger value="advanced">{t('nlbForm.tab.advanced')}</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('nlbForm.label.name')} *</Label>
                <Input
                  id="name"
                  {...register('name', {
                    required: t('nlbForm.rhf.nameRequired'),
                    validate: (value) => {
                      const validation = isValidNLBName(value);
                      return validation.valid || t(validation.errorKey!);
                    },
                  })}
                  placeholder={t(getExampleValueKey('name'))}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {getValidationHintKey('name') ? t(getValidationHintKey('name')) : ''}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('nlbForm.label.description')}</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder={t('nlbForm.placeholder.description')}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="port">{t('nlbForm.label.portListen')} *</Label>
                  <Input
                    id="port"
                    type="number"
                    {...register('port', {
                      required: t('nlbForm.rhf.portRequired'),
                      min: { value: 10000, message: t('nlbForm.validation.portRange') },
                      max: { value: 65535, message: t('nlbForm.validation.portRange') },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.port && (
                    <p className="text-sm text-destructive">{errors.port.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {getValidationHintKey('port') ? t(getValidationHintKey('port')) : ''}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="protocol">{t('nlbForm.label.protocol')} *</Label>
                  <Select
                    value={protocol}
                    onValueChange={(value) => setValue('protocol', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tcp">{t('nlbForm.proto.tcp')}</SelectItem>
                      <SelectItem value="udp">{t('nlbForm.proto.udp')}</SelectItem>
                      <SelectItem value="tcp_udp">{t('nlbForm.proto.tcpUdp')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="algorithm">{t('nlbForm.label.algorithm')}</Label>
                <Select
                  defaultValue="round_robin"
                  onValueChange={(value) => setValue('algorithm', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">{t('nlbForm.algo.roundRobin')}</SelectItem>
                    <SelectItem value="least_conn">{t('nlbForm.algo.leastConn')}</SelectItem>
                    <SelectItem value="ip_hash">{t('nlbForm.algo.ipHash')}</SelectItem>
                    <SelectItem value="hash">{t('nlbForm.algo.hash')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="upstreams" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <Label>{t('nlbForm.label.backendServers')} *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addUpstream}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('nlbForm.label.addUpstream')}
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-medium">
                          {t('nlbForm.label.upstreamN', { n: index + 1 })}
                        </h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('nlbForm.label.host')} *</Label>
                          <Input
                            {...register(`upstreams.${index}.host`, {
                              required: t('nlbForm.rhf.upstreamHostRequired'),
                              validate: (value) => {
                                const validation = validateUpstreamHost(value);
                                return validation.valid || t(validation.errorKey!);
                              },
                            })}
                            placeholder={t(getExampleValueKey('host'))}
                          />
                          {errors.upstreams?.[index]?.host && (
                            <p className="text-sm text-destructive">
                              {errors.upstreams[index]?.host?.message}
                            </p>
                          )}
                          {!errors.upstreams?.[index]?.host && (
                            <p className="text-xs text-muted-foreground">
                              {getValidationHintKey('host') ? t(getValidationHintKey('host')) : ''}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>{t('common.port')} *</Label>
                          <Input
                            type="number"
                            {...register(`upstreams.${index}.port`, {
                              required: t('nlbForm.rhf.upstreamPortRequired'),
                              min: { value: 1, message: t('nlbForm.rhf.upstreamPortMin') },
                              max: { value: 65535, message: t('nlbForm.rhf.upstreamPortMax') },
                              valueAsNumber: true,
                            })}
                          />
                          {errors.upstreams?.[index]?.port && (
                            <p className="text-sm text-destructive">
                              {errors.upstreams[index]?.port?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>{t('nlbForm.label.weight')}</Label>
                          <Input
                            type="number"
                            {...register(`upstreams.${index}.weight`, {
                              min: { value: 1, message: t('nlbForm.rhf.weightMin') },
                              max: { value: 100, message: t('nlbForm.rhf.weightMax') },
                              valueAsNumber: true,
                            })}
                          />
                          {errors.upstreams?.[index]?.weight && (
                            <p className="text-xs text-destructive">
                              {errors.upstreams[index]?.weight?.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>{t('nlbForm.label.maxFails')}</Label>
                          <Input
                            type="number"
                            {...register(`upstreams.${index}.maxFails`, {
                              min: { value: 0, message: t('nlbForm.rhf.maxFailsMin') },
                              max: { value: 100, message: t('nlbForm.rhf.maxFailsMax') },
                              valueAsNumber: true,
                            })}
                          />
                          {errors.upstreams?.[index]?.maxFails && (
                            <p className="text-xs text-destructive">
                              {errors.upstreams[index]?.maxFails?.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>{t('nlbForm.label.failTimeout')}</Label>
                          <Input
                            type="number"
                            {...register(`upstreams.${index}.failTimeout`, {
                              min: { value: 1, message: t('nlbForm.rhf.failTimeoutMin') },
                              max: { value: 3600, message: t('nlbForm.rhf.failTimeoutMax') },
                              valueAsNumber: true,
                            })}
                          />
                          {errors.upstreams?.[index]?.failTimeout && (
                            <p className="text-xs text-destructive">
                              {errors.upstreams[index]?.failTimeout?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>{t('nlbForm.label.maxConns')}</Label>
                          <Input
                            type="number"
                            {...register(`upstreams.${index}.maxConns`, {
                              min: { value: 0, message: t('nlbForm.rhf.maxConnsMin') },
                              max: { value: 100000, message: t('nlbForm.rhf.maxConnsMax') },
                              valueAsNumber: true,
                            })}
                            placeholder={t('nlbForm.placeholder.unlimited')}
                          />
                          {errors.upstreams?.[index]?.maxConns && (
                            <p className="text-xs text-destructive">
                              {errors.upstreams[index]?.maxConns?.message}
                            </p>
                          )}
                        </div>

                        <TooltipProvider>
                          <div className="flex items-center space-x-2">
                            <Controller
                              name={`upstreams.${index}.backup`}
                              control={control}
                              render={({ field }) => (
                                <Switch
                                  id={`backup-${index}`}
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                            <Label htmlFor={`backup-${index}`}>{t('nlbForm.label.backup')}</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('nlbForm.tooltip.backup')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>

                        <TooltipProvider>
                          <div className="flex items-center space-x-2">
                            <Controller
                              name={`upstreams.${index}.down`}
                              control={control}
                              render={({ field }) => (
                                <Switch
                                  id={`down-${index}`}
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                            <Label htmlFor={`down-${index}`}>{t('nlbForm.label.markDown')}</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('nlbForm.tooltip.markDown')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {errors.upstreams && (
                <p className="text-sm text-destructive">{t('nlbForm.rhf.upstreamsRequired')}</p>
              )}

              {/* Configuration Warnings */}
              {configWarnings.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">
                        {t('nlbForm.warningsHeading')}
                      </h4>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        {configWarnings.map((warning, idx) => (
                          <li key={idx}>
                            • {t(warning.key, warning.values as Record<string, string | number>)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-4">{t('nlbForm.section.proxy')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('nlbForm.label.proxyTimeout')}</Label>
                    <Input
                      type="number"
                      {...register('proxyTimeout', {
                        min: { value: 1, message: t('nlbForm.rhf.proxyTimeoutMin') },
                        max: { value: 3600, message: t('nlbForm.rhf.proxyTimeoutMax') },
                        valueAsNumber: true,
                      })}
                    />
                    {errors.proxyTimeout && (
                      <p className="text-xs text-destructive">{errors.proxyTimeout.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {getValidationHintKey('proxyTimeout') ? t(getValidationHintKey('proxyTimeout')) : ''}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('nlbForm.label.proxyConnectTimeoutLabel')}</Label>
                    <Input
                      type="number"
                      {...register('proxyConnectTimeout', {
                        min: { value: 1, message: t('nlbForm.rhf.proxyConnectMin') },
                        max: { value: 300, message: t('nlbForm.rhf.proxyConnectMax') },
                        valueAsNumber: true,
                      })}
                    />
                    {errors.proxyConnectTimeout && (
                      <p className="text-xs text-destructive">{errors.proxyConnectTimeout.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {getValidationHintKey('proxyConnectTimeout')
                        ? t(getValidationHintKey('proxyConnectTimeout'))
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Controller
                      name="proxyNextUpstream"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          id="proxyNextUpstream"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="proxyNextUpstream">{t('nlbForm.label.proxyNextUpstream')}</Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t('nlbForm.label.nextUpstreamTimeout')}</Label>
                    <Input
                      type="number"
                      {...register('proxyNextUpstreamTimeout', {
                        min: { value: 0, message: t('nlbForm.rhf.nextTimeoutMin') },
                        max: { value: 3600, message: t('nlbForm.rhf.nextTimeoutMax') },
                        valueAsNumber: true,
                      })}
                      placeholder={t('nlbForm.placeholder.disabled')}
                    />
                    {errors.proxyNextUpstreamTimeout && (
                      <p className="text-xs text-destructive">{errors.proxyNextUpstreamTimeout.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('nlbForm.label.nextUpstreamTries')}</Label>
                    <Input
                      type="number"
                      {...register('proxyNextUpstreamTries', {
                        min: { value: 0, message: t('nlbForm.rhf.nextTriesMin') },
                        max: { value: 100, message: t('nlbForm.rhf.nextTriesMax') },
                        valueAsNumber: true,
                      })}
                      placeholder={t('nlbForm.placeholder.unlimited')}
                    />
                    {errors.proxyNextUpstreamTries && (
                      <p className="text-xs text-destructive">{errors.proxyNextUpstreamTries.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-4">{t('nlbForm.section.health')}</h4>
                <div className="flex items-center space-x-2 mb-4">
                  <Controller
                    name="healthCheckEnabled"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        id="healthCheckEnabled"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label htmlFor="healthCheckEnabled">{t('nlbForm.label.healthEnabled')}</Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('nlbForm.label.checkInterval')}</Label>
                    <Input
                      type="number"
                      {...register('healthCheckInterval', {
                        min: { value: 5, message: t('nlbForm.rhf.healthIntervalMin') },
                        max: { value: 3600, message: t('nlbForm.rhf.healthIntervalMax') },
                        valueAsNumber: true,
                      })}
                    />
                    {errors.healthCheckInterval && (
                      <p className="text-xs text-destructive">{errors.healthCheckInterval.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {getValidationHintKey('healthCheckInterval')
                        ? t(getValidationHintKey('healthCheckInterval'))
                        : ''}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('nlbForm.label.checkTimeout')}</Label>
                    <Input
                      type="number"
                      {...register('healthCheckTimeout', {
                        min: { value: 1, message: t('nlbForm.rhf.healthTimeoutMin') },
                        max: { value: 300, message: t('nlbForm.rhf.healthTimeoutMax') },
                        valueAsNumber: true,
                      })}
                    />
                    {errors.healthCheckTimeout && (
                      <p className="text-xs text-destructive">{errors.healthCheckTimeout.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {getValidationHintKey('healthCheckTimeout')
                        ? t(getValidationHintKey('healthCheckTimeout'))
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t('nlbForm.label.rises')}</Label>
                    <Input
                      type="number"
                      {...register('healthCheckRises', {
                        min: { value: 1, message: t('nlbForm.rhf.risesMin') },
                        max: { value: 10, message: t('nlbForm.rhf.risesMax') },
                        valueAsNumber: true,
                      })}
                    />
                    {errors.healthCheckRises && (
                      <p className="text-xs text-destructive">{errors.healthCheckRises.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('nlbForm.label.falls')}</Label>
                    <Input
                      type="number"
                      {...register('healthCheckFalls', {
                        min: { value: 1, message: t('nlbForm.rhf.fallsMin') },
                        max: { value: 10, message: t('nlbForm.rhf.fallsMax') },
                        valueAsNumber: true,
                      })}
                    />
                    {errors.healthCheckFalls && (
                      <p className="text-xs text-destructive">{errors.healthCheckFalls.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? t('nlbForm.submit.saving')
                : mode === 'create'
                ? t('nlbForm.submit.create')
                : t('nlbForm.submit.update')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
