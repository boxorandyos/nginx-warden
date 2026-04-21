import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Eye, EyeOff, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  validateAccessListName,
  validateAccessListIp,
  validateUsername,
  validatePassword,
  getAccessListHintKey,
  getAccessListExample,
  type AccessListFieldValidation,
} from '@/utils/access-list-validators';
import {
  useCreateAccessList,
  useUpdateAccessList,
  useRemoveFromDomain,
} from '@/queries/access-lists.query-options';
import { domainQueryOptions } from '@/queries/domain.query-options';
import type { AccessList } from '@/services/access-lists.service';

interface AccessListFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessList?: AccessList;
}

interface AuthUserFormData {
  username: string;
  password: string;
  description?: string;
  showPassword?: boolean;
}

export function AccessListFormDialog({
  open,
  onOpenChange,
  accessList,
}: AccessListFormDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isEditMode = !!accessList;

  const createMutation = useCreateAccessList();
  const updateMutation = useUpdateAccessList();
  const removeFromDomainMutation = useRemoveFromDomain();

  // Fetch domains for selection
  const { data: domainsData } = useQuery(domainQueryOptions.all({ page: 1, limit: 100 }));
  const domains = domainsData?.data || [];

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'ip_whitelist' as 'ip_whitelist' | 'http_basic_auth' | 'combined',
    enabled: true,
  });

  const [allowedIps, setAllowedIps] = useState<string[]>(['']);
  const [authUsers, setAuthUsers] = useState<AuthUserFormData[]>([
    { username: '', password: '', description: '', showPassword: false },
  ]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [originalDomainIds, setOriginalDomainIds] = useState<string[]>([]); // Track original domains for edit mode

  // Validation states
  const [nameValidation, setNameValidation] = useState<AccessListFieldValidation>({ valid: true });
  const [ipValidations, setIpValidations] = useState<Record<number, AccessListFieldValidation>>({});
  const [userValidations, setUserValidations] = useState<
    Record<number, { username: AccessListFieldValidation; password: AccessListFieldValidation }>
  >({});

  // Validate name in real-time
  useEffect(() => {
    if (formData.name.trim().length > 0) {
      setNameValidation(validateAccessListName(formData.name));
    } else {
      setNameValidation({ valid: true });
    }
  }, [formData.name]);

  // Reset form when dialog opens or access list changes
  useEffect(() => {
    if (open) {
      if (accessList) {
        // Edit mode
        setFormData({
          name: accessList.name,
          description: accessList.description || '',
          type: accessList.type,
          enabled: accessList.enabled,
        });

        setAllowedIps(
          accessList.allowedIps && accessList.allowedIps.length > 0
            ? accessList.allowedIps
            : ['']
        );

        setAuthUsers(
          accessList.authUsers && accessList.authUsers.length > 0
            ? accessList.authUsers.map((u) => ({
                username: u.username,
                password: '', // Don't populate password for security
                description: u.description || '',
                showPassword: false,
              }))
            : [{ username: '', password: '', description: '', showPassword: false }]
        );

        const domainIds = accessList.domains?.map((d) => d.domainId) || [];
        setSelectedDomains(domainIds);
        setOriginalDomainIds(domainIds); // Store original for comparison
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          description: '',
          type: 'ip_whitelist',
          enabled: true,
        });
        setAllowedIps(['']);
        setAuthUsers([{ username: '', password: '', description: '', showPassword: false }]);
        setSelectedDomains([]);
        setOriginalDomainIds([]); // Reset original domains
      }
      setNameValidation({ valid: true });
      setIpValidations({});
      setUserValidations({});
    }
  }, [open, accessList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast({
        title: t('common.error'),
        description: t('accessLists.toast.errNameRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (formData.type === 'ip_whitelist' || formData.type === 'combined') {
      const validIps = allowedIps.filter((ip) => ip.trim());
      if (validIps.length === 0) {
        toast({
          title: t('common.error'),
          description: t('accessLists.toast.errIpsRequired'),
          variant: 'destructive',
        });
        return;
      }
    }

    if (formData.type === 'http_basic_auth' || formData.type === 'combined') {
      // In edit mode, password is optional (empty = keep existing)
      // In create mode, password is required
      const validUsers = authUsers.filter((u) => {
        if (isEditMode) {
          return u.username.trim(); // Only username required in edit mode
        }
        return u.username.trim() && u.password.trim(); // Both required in create mode
      });
      
      if (validUsers.length === 0) {
        toast({
          title: t('common.error'),
          description: t('accessLists.toast.errAuthUsersRequired'),
          variant: 'destructive',
        });
        return;
      }

      for (const user of validUsers) {
        if (!user.username.trim()) {
          toast({
            title: t('common.error'),
            description: t('accessLists.toast.errUsernameAll'),
            variant: 'destructive',
          });
          return;
        }
        if (!isEditMode && !user.password.trim()) {
          toast({
            title: t('common.error'),
            description: t('accessLists.toast.errPasswordNew'),
            variant: 'destructive',
          });
          return;
        }
        if (user.password.trim() && user.password.length < 4) {
          toast({
            title: t('common.error'),
            description: t('accessLists.toast.errPasswordMin'),
            variant: 'destructive',
          });
          return;
        }
      }
    }

    const payload = {
      ...formData,
      allowedIps:
        formData.type === 'ip_whitelist' || formData.type === 'combined'
          ? allowedIps.filter((ip) => ip.trim())
          : undefined,
      authUsers:
        formData.type === 'http_basic_auth' || formData.type === 'combined'
          ? authUsers
              .filter((u) => {
                // In create mode, require both username and password
                // In edit mode, only require username (empty password = keep existing)
                if (isEditMode) {
                  return u.username.trim();
                }
                return u.username.trim() && u.password.trim();
              })
              .map(({ username, password, description }) => ({
                username,
                password, // In edit mode, empty password will be handled by backend
                description,
              }))
          : undefined,
      domainIds: selectedDomains.length > 0 ? selectedDomains : undefined,
    };

    try {
      if (isEditMode) {
        // Detect removed domains (domains that were assigned but now unchecked)
        const removedDomainIds = originalDomainIds.filter(
          (domainId) => !selectedDomains.includes(domainId)
        );

        // Remove domains first if any
        if (removedDomainIds.length > 0) {
          await Promise.all(
            removedDomainIds.map((domainId) =>
              removeFromDomainMutation.mutateAsync({
                accessListId: accessList.id,
                domainId,
              })
            )
          );
        }

        // Then update the access list
        await updateMutation.mutateAsync({ id: accessList.id, data: payload });
        toast({
          title: t('common.success'),
          description: t('accessLists.toast.updateSuccess'),
        });
      } else {
        await createMutation.mutateAsync(payload);
        toast({
          title: t('common.success'),
          description: t('accessLists.toast.createSuccess'),
        });
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.message || t('accessLists.toast.saveFailed'),
        variant: 'destructive',
      });
    }
  };

  const addIpField = () => {
    setAllowedIps([...allowedIps, '']);
  };

  const removeIpField = (index: number) => {
    setAllowedIps(allowedIps.filter((_, i) => i !== index));
  };

  const updateIpField = (index: number, value: string) => {
    const newIps = [...allowedIps];
    newIps[index] = value;
    setAllowedIps(newIps);

    // Validate IP in real-time
    if (value.trim().length > 0) {
      const validation = validateAccessListIp(value);
      setIpValidations(prev => ({ ...prev, [index]: validation }));
    } else {
      setIpValidations(prev => {
        const newValidations = { ...prev };
        delete newValidations[index];
        return newValidations;
      });
    }
  };

  const addAuthUser = () => {
    setAuthUsers([
      ...authUsers,
      { username: '', password: '', description: '', showPassword: false },
    ]);
  };

  const removeAuthUser = (index: number) => {
    setAuthUsers(authUsers.filter((_, i) => i !== index));
  };

  const updateAuthUser = (
    index: number,
    field: keyof AuthUserFormData,
    value: string | boolean
  ) => {
    const newUsers = [...authUsers];
    (newUsers[index] as any)[field] = value;
    setAuthUsers(newUsers);

    // Validate username/password in real-time
    if (field === 'username' && typeof value === 'string') {
      if (value.trim().length > 0) {
        const validation = validateUsername(value);
        setUserValidations(prev => ({
          ...prev,
          [index]: {
            username: validation,
            password: prev[index]?.password || { valid: true }
          }
        }));
      }
    } else if (field === 'password' && typeof value === 'string') {
      if (value.trim().length > 0) {
        const validation = validatePassword(value, !isEditMode);
        setUserValidations(prev => ({
          ...prev,
          [index]: {
            username: prev[index]?.username || { valid: true },
            password: validation
          }
        }));
      }
    }
  };

  const toggleDomainSelection = (domainId: string) => {
    console.log('Toggling domain:', domainId);
    setSelectedDomains((prev) => {
      const isSelected = prev.includes(domainId);
      console.log('Current selected:', prev);
      console.log('Is selected:', isSelected);
      const newSelection = isSelected
        ? prev.filter((id) => id !== domainId)
        : [...prev, domainId];
      console.log('New selection:', newSelection);
      return newSelection;
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const trField = (v: AccessListFieldValidation): string =>
    v.valid ? '' : t(v.errorKey, v.errorParams as Record<string, string | number> | undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('accessLists.form.titleEdit') : t('accessLists.form.titleCreate')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? t('accessLists.form.descEdit') : t('accessLists.form.descCreate')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('accessLists.form.nameLabel')}</Label>
              <div className="relative">
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={getAccessListExample('name')}
                  disabled={isPending}
                  required
                  className={!nameValidation.valid && formData.name.trim().length > 0 ? 'border-red-500' : nameValidation.valid && formData.name.trim().length > 0 ? 'border-green-500' : ''}
                />
                {nameValidation.valid && formData.name.trim().length > 0 && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {!nameValidation.valid && formData.name.trim().length > 0 && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                )}
              </div>
              {!nameValidation.valid && (
                <p className="text-xs text-red-500 mt-1">{trField(nameValidation)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {t(getAccessListHintKey('name'))}
              </p>
            </div>

            <div>
              <Label htmlFor="description">{t('accessLists.form.descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t('accessLists.form.descriptionPlaceholder')}
                disabled={isPending}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="type">{t('accessLists.form.typeLabel')}</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, type: value })
                }
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip_whitelist">{t('accessLists.form.typeIpWhitelist')}</SelectItem>
                  <SelectItem value="http_basic_auth">
                    {t('accessLists.form.typeHttpBasic')}
                  </SelectItem>
                  <SelectItem value="combined">
                    {t('accessLists.form.typeCombined')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
                disabled={isPending}
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                {t('accessLists.form.enableLabel')}
              </Label>
            </div>
          </div>

          {/* Configuration Tabs */}
          <Tabs defaultValue="access" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="access">{t('accessLists.form.tabAccess')}</TabsTrigger>
              <TabsTrigger value="domains">{t('accessLists.form.tabDomains')}</TabsTrigger>
            </TabsList>

            <TabsContent value="access" className="space-y-4">
              {/* IP Whitelist */}
              {(formData.type === 'ip_whitelist' ||
                formData.type === 'combined') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('accessLists.form.allowedIpsLabel')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addIpField}
                      disabled={isPending}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('accessLists.form.addIp')}
                    </Button>
                  </div>

                  {allowedIps.map((ip, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            value={ip}
                            onChange={(e) => updateIpField(index, e.target.value)}
                            placeholder={getAccessListExample('ip')}
                            disabled={isPending}
                            className={ipValidations[index] && !ipValidations[index].valid ? 'border-red-500' : ipValidations[index]?.valid ? 'border-green-500' : ''}
                          />
                          {ipValidations[index]?.valid && ip.trim().length > 0 && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                          )}
                          {ipValidations[index] && !ipValidations[index].valid && (
                            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                          )}
                        </div>
                        {allowedIps.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeIpField(index)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {ipValidations[index] && !ipValidations[index].valid && (
                        <p className="text-xs text-red-500">{trField(ipValidations[index])}</p>
                      )}
                    </div>
                  ))}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{t('acl.hintLabel')}:</strong> {t(getAccessListHintKey('ip'))}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* HTTP Basic Auth */}
              {(formData.type === 'http_basic_auth' ||
                formData.type === 'combined') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('accessLists.form.authUsersLabel')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAuthUser}
                      disabled={isPending}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('accessLists.form.addUser')}
                    </Button>
                  </div>

                  {authUsers.map((user, index) => (
                    <div key={index} className="space-y-2 p-4 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium">
                          {t('accessLists.form.userN', { n: index + 1 })}
                        </Label>
                        {authUsers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAuthUser(index)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">{t('accessLists.form.usernameLabel')}</Label>
                          <div className="relative">
                            <Input
                              value={user.username}
                              onChange={(e) =>
                                updateAuthUser(index, 'username', e.target.value)
                              }
                              placeholder={getAccessListExample('username')}
                              disabled={isPending}
                              minLength={3}
                              className={userValidations[index]?.username && !userValidations[index].username.valid ? 'border-red-500' : userValidations[index]?.username?.valid ? 'border-green-500' : ''}
                            />
                            {userValidations[index]?.username?.valid && user.username.trim().length > 0 && (
                              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                            )}
                            {userValidations[index]?.username && !userValidations[index].username.valid && (
                              <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                            )}
                          </div>
                          {userValidations[index]?.username && !userValidations[index].username.valid && (
                            <p className="text-xs text-red-500 mt-1">
                              {trField(userValidations[index].username)}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs">{t('accessLists.form.passwordLabel')}</Label>
                          <div className="relative">
                            <Input
                              type={user.showPassword ? 'text' : 'password'}
                              value={user.password}
                              minLength={4}
                              onChange={(e) =>
                                updateAuthUser(index, 'password', e.target.value)
                              }
                              placeholder={t('accessLists.form.passwordPlaceholder')}
                              disabled={isPending}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() =>
                                updateAuthUser(
                                  index,
                                  'showPassword',
                                  !user.showPassword
                                )
                              }
                            >
                              {user.showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {userValidations[index]?.password &&
                            !userValidations[index].password.valid &&
                            user.password.trim().length > 0 && (
                              <p className="text-xs text-red-500 mt-1">
                                {trField(userValidations[index].password)}
                              </p>
                            )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">{t('accessLists.form.userDescriptionLabel')}</Label>
                        <Input
                          value={user.description}
                          onChange={(e) =>
                            updateAuthUser(index, 'description', e.target.value)
                          }
                          placeholder={t('accessLists.form.userDescriptionPlaceholder')}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="domains" className="space-y-4">
              <div>
                <Label>{t('accessLists.form.domainsLabel')}</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('accessLists.form.domainsHelp')}
                </p>

                {domains.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('accessLists.form.noDomains')}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {domains.map((domain) => {
                      const isSelected = selectedDomains.includes(domain.id);
                      return (
                        <div
                          key={domain.id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md"
                        >
                          <Switch
                            checked={isSelected}
                            onCheckedChange={() => toggleDomainSelection(domain.id)}
                            disabled={isPending}
                          />
                          <div 
                            className="flex-1 flex items-center justify-between cursor-pointer"
                            onClick={() => !isPending && toggleDomainSelection(domain.id)}
                          >
                            <span className="text-sm font-medium">{domain.name}</span>
                            <Badge variant={domain.status === 'active' ? 'default' : 'secondary'}>
                              {domain.status === 'active'
                                ? t('accessLists.form.domainStatusActive')
                                : domain.status === 'inactive'
                                  ? t('accessLists.form.domainStatusInactive')
                                  : domain.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t('accessLists.form.saving')
                : isEditMode
                ? t('accessLists.form.submitUpdate')
                : t('accessLists.form.submitCreate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
