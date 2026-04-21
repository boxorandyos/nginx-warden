import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  User, 
  Key, 
  Shield, 
  Activity, 
  Save, 
  Eye, 
  EyeOff, 
  Copy, 
  CheckCircle2,
  Lock,
  Smartphone,
  Globe,
  Clock,
  MapPin
} from "lucide-react";
import { UserProfile, ActivityLog, AccountSession } from "@/types";
import { toast } from "sonner";
import { accountService } from "@/services/auth.service";
import { tokenStorage } from "@/lib/auth-storage";
import { DEFAULT_LOCALE, isLocaleCode, SUPPORTED_LOCALES, type LocaleCode } from "@/locales";
import { DEFAULT_TIMEZONE } from "@/lib/timezones";
import { getUserAvatarInitials } from "@/lib/user-avatar";
import { TimezoneSelect } from "@/components/ui/timezone-select";

function formatSessionTitle(session: AccountSession): string {
  const d = session.device?.trim();
  if (d) return d;
  const ua = session.userAgent || "";
  return ua.length > 96 ? `${ua.slice(0, 96)}…` : ua;
}

function isMobileUserAgent(ua: string): boolean {
  return /Mobile|Android|iPhone|iPad/i.test(ua);
}

const Account = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString(i18n.language);
  const fmtDateTime = (d: string | Date) => new Date(d).toLocaleString(i18n.language);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  } | null>(null);
  const [verificationToken, setVerificationToken] = useState("");
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    timezone: "",
    language: "en" as LocaleCode
  });

  // Load profile on mount
  useEffect(() => {
    loadProfile();
    loadActivityLogs();
    loadSessions();
  }, []);

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone || "",
        timezone: profile.timezone?.trim() ? profile.timezone : DEFAULT_TIMEZONE,
        language: isLocaleCode(profile.language) ? profile.language : DEFAULT_LOCALE,
      });
    }
  }, [profile]);

  const loadProfile = async () => {
    try {
      const data = await accountService.getProfile();
      setProfile(data);
      setTwoFactorEnabled(data.twoFactorEnabled);
    } catch (error: any) {
      toast.error(t("common.error"), {
        description: error.response?.data?.message || t("account.toast.loadFailed"),
      });
    }
  };

  const loadActivityLogs = async () => {
    try {
      const data = await accountService.getActivityLogs(1, 10);
      setActivityLogs(data.logs);
    } catch (error: any) {
      console.error("Failed to load activity logs:", error);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await accountService.getSessions();
      setSessions(data);
    } catch (error: any) {
      console.error("Failed to load sessions:", error);
    }
  };

  const handleRevokeSession = async (session: AccountSession) => {
    setRevokingId(session.sessionId);
    try {
      await accountService.revokeSession(session.sessionId);
      toast.success(t("account.sessions.revoked"));
      if (session.isCurrent) {
        tokenStorage.clearAuth();
        navigate({ to: "/login" });
      } else {
        await loadSessions();
      }
    } catch (error: any) {
      toast.error(t("common.error"), {
        description: error.response?.data?.message || t("account.sessions.revokeFailed"),
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      const updatedProfile = await accountService.updateProfile(profileForm);
      setProfile(updatedProfile);
      toast.success(t("account.toast.profileUpdated"), {
        description: t("account.toast.profileUpdatedDesc"),
      });
    } catch (error: any) {
      toast.error(t("common.error"), {
        description: error.response?.data?.message || t("account.toast.updateFailed"),
      });
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t("account.toast.passwordMismatch"), {
        description: t("account.toast.passwordMismatchDesc"),
      });
      return;
    }

    // Validate password strength
    const hasMinLength = passwordForm.newPassword.length >= 8;
    const hasUpperCase = /[A-Z]/.test(passwordForm.newPassword);
    const hasLowerCase = /[a-z]/.test(passwordForm.newPassword);
    const hasNumber = /\d/.test(passwordForm.newPassword);

    if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumber) {
      toast.error(t("account.toast.weakPassword"), {
        description: t("account.toast.weakPasswordDesc"),
      });
      return;
    }

    try {
      await accountService.changePassword(passwordForm);
      toast.success(t("account.toast.passwordChanged"), {
        description: t("account.toast.passwordChangedDesc"),
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error: any) {
      toast.error(t("common.error"), {
        description: error.response?.data?.message || t("account.toast.changePasswordFailed"),
      });
    }
  };

  const handleEnable2FA = async () => {
    if (twoFactorEnabled) {
      // Disable 2FA - need password confirmation
      const password = prompt(t("account.prompt.disable2fa"));
      if (!password) return;

      try {
        await accountService.disable2FA(password);
        setTwoFactorEnabled(false);
        setTwoFactorSetup(null);
        toast.warning(t("account.toast.2faDisabled"), {
          description: t("account.toast.2faDisabledDesc"),
        });
      } catch (error: any) {
        toast.error(t("common.error"), {
          description: error.response?.data?.message || t("account.toast.disable2faFailed"),
        });
      }
    } else {
      // Setup 2FA - get QR code
      try {
        const setup = await accountService.setup2FA();
        setTwoFactorSetup(setup);
        toast.info(t("account.toast.2faSetupReady"), {
          description: t("account.toast.2faSetupReadyDesc"),
        });
      } catch (error: any) {
        toast.error(t("common.error"), {
          description: error.response?.data?.message || t("account.toast.setup2faFailed"),
        });
      }
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationToken || verificationToken.length !== 6) {
      toast.error(t("account.toast.invalidToken"), {
        description: t("account.toast.invalidTokenDesc"),
      });
      return;
    }

    try {
      await accountService.enable2FA(verificationToken);
      setTwoFactorEnabled(true);
      setTwoFactorSetup(null);
      setVerificationToken("");
      toast.success(t("account.toast.2faEnabled"), {
        description: t("account.toast.2faEnabledDesc"),
      });
      loadProfile();
    } catch (error: any) {
      toast.error(t("common.error"), {
        description: error.response?.data?.message || t("account.toast.verifyFailed"),
      });
    }
  };

  const copyBackupCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t("account.toast.codeCopied"), {
      description: t("account.toast.codeCopiedDesc"),
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login': return <User className="h-4 w-4" />;
      case 'logout': return <User className="h-4 w-4" />;
      case 'security': return <Shield className="h-4 w-4" />;
      case 'config_change': return <Activity className="h-4 w-4" />;
      case 'user_action': return <Activity className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'login': return 'default';
      case 'logout': return 'secondary';
      case 'security': return 'destructive';
      case 'config_change': return 'outline';
      case 'user_action': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("account.title")}</h1>
            <p className="text-muted-foreground">{t("account.subtitle")}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            {t("account.tab.profile")}
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            {t("account.tab.security")}
          </TabsTrigger>
          <TabsTrigger value="2fa">
            <Smartphone className="h-4 w-4 mr-2" />
            {t("account.tab.twoFactor")}
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            {t("account.tab.activityLog")}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("account.profile.title")}</CardTitle>
              <CardDescription>{t("account.profile.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile && (
                <>
                  <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={profile.avatar ?? undefined} alt={profile.fullName} />
                      <AvatarFallback className="text-lg font-semibold">{getUserAvatarInitials(profile)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-medium">{profile.fullName}</h3>
                      <p className="text-sm text-muted-foreground">@{profile.username}</p>
                      <Badge variant="default" className="mt-2">
                        <Shield className="h-3 w-3 mr-1" />
                        {profile.role}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="fullName">{t("account.profile.fullName")}</Label>
                      <Input
                        id="fullName"
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">{t("account.profile.email")}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">{t("account.profile.phone")}</Label>
                      <Input
                        id="phone"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder={t("account.profile.phonePlaceholder")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="timezone">{t("account.profile.timezone")}</Label>
                      <TimezoneSelect
                        id="timezone"
                        value={profileForm.timezone || DEFAULT_TIMEZONE}
                        onChange={(tz) => setProfileForm({ ...profileForm, timezone: tz })}
                        placeholder={t("account.profile.timezonePlaceholder")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="language">{t("account.profile.language")}</Label>
                      <Select value={profileForm.language} onValueChange={(value: LocaleCode) => setProfileForm({ ...profileForm, language: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_LOCALES.map((loc) => (
                            <SelectItem key={loc.code} value={loc.code}>
                              {loc.nativeLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      <p>{t("account.profile.accountCreated")}: {fmtDate(profile.createdAt)}</p>
                      <p>{t("account.profile.lastLogin")}: {fmtDateTime(profile.lastLogin)}</p>
                    </div>
                    <Button onClick={handleProfileUpdate}>
                      <Save className="h-4 w-4 mr-2" />
                      {t("account.profile.save")}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("account.security.title")}</CardTitle>
              <CardDescription>{t("account.security.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  {t("account.security.hint")}
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currentPassword">{t("account.security.current")}</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="newPassword">{t("account.security.new")}</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">{t("account.security.confirm")}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Button onClick={handlePasswordChange} className="w-full">
                <Key className="h-4 w-4 mr-2" />
                {t("account.security.submit")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2FA Tab */}
        <TabsContent value="2fa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("account.twoFactor.title")}</CardTitle>
              <CardDescription>{t("account.twoFactor.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{t("account.twoFactor.enable")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("account.twoFactor.enableHelp")}
                  </p>
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={handleEnable2FA}
                />
              </div>

              {twoFactorSetup && (
                <>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {t("account.twoFactor.scanAlert")}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">{t("account.twoFactor.authTitle")}</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("account.twoFactor.authDesc")}
                      </p>
                      <div className="flex items-center justify-center p-4 bg-white rounded-lg">
                        <img 
                          src={twoFactorSetup.qrCode} 
                          alt={t("account.twoFactor.qrAlt")} 
                          className="w-48 h-48"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-center font-mono">
                        {t("account.twoFactor.secret", { secret: twoFactorSetup.secret })}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">{t("account.twoFactor.verifyTitle")}</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("account.twoFactor.verifyDesc")}
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder={t("account.twoFactor.codePlaceholder")}
                          value={verificationToken}
                          onChange={(e) => setVerificationToken(e.target.value)}
                          maxLength={6}
                        />
                        <Button onClick={handleVerify2FA}>
                          {t("account.twoFactor.verify")}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">{t("account.twoFactor.backupTitle")}</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("account.twoFactor.backupDesc")}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {twoFactorSetup.backupCodes?.map((code, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded border">
                            <code className="text-sm font-mono">{code}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyBackupCode(code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {twoFactorEnabled && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    {t("account.twoFactor.alertEnabled")}
                  </AlertDescription>
                </Alert>
              )}

              {!twoFactorEnabled && !twoFactorSetup && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    {t("account.twoFactor.alertDisabled")}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("account.activity.title")}</CardTitle>
              <CardDescription>{t("account.activity.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("account.activity.col.action")}</TableHead>
                      <TableHead>{t("account.activity.col.type")}</TableHead>
                      <TableHead>{t("account.activity.col.ip")}</TableHead>
                      <TableHead>{t("account.activity.col.location")}</TableHead>
                      <TableHead>{t("account.activity.col.time")}</TableHead>
                      <TableHead>{t("account.activity.col.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            {getActivityIcon(log.type)}
                            <div>
                              <p className="font-medium">{log.action}</p>
                              {log.details && (
                                <p className="text-xs text-muted-foreground">{log.details}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActivityColor(log.type)}>
                            {t(`account.activity.type.${log.type}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.ip}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {t("account.activity.locationUnknown")}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {fmtDateTime(log.timestamp)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="default">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t("account.activity.status.success")}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              {t("account.activity.status.failed")}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("account.sessions.title")}</CardTitle>
              <CardDescription>{t("account.sessions.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("account.sessions.empty")}</p>
                ) : (
                  sessions.map((session) => {
                    const mobile = isMobileUserAgent(session.userAgent);
                    const subtitle = [session.ip, session.location?.trim()].filter(Boolean).join(" · ");
                    return (
                      <div
                        key={session.sessionId}
                        className="flex items-center justify-between gap-4 p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={
                              session.isCurrent ? "p-2 bg-primary/10 rounded-lg shrink-0" : "p-2 bg-muted rounded-lg shrink-0"
                            }
                          >
                            {mobile ? (
                              <Smartphone className={`h-5 w-5 ${session.isCurrent ? "text-primary" : ""}`} />
                            ) : (
                              <Globe className={`h-5 w-5 ${session.isCurrent ? "text-primary" : ""}`} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium truncate">{formatSessionTitle(session)}</p>
                              {session.isCurrent ? (
                                <Badge variant="default">{t("account.sessions.current")}</Badge>
                              ) : (
                                <Badge variant="secondary">{t("account.sessions.badgeActive")}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("account.sessions.lastActive", { time: fmtDateTime(session.lastActive) })}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          disabled={revokingId === session.sessionId}
                          onClick={() => void handleRevokeSession(session)}
                        >
                          {t("account.sessions.revoke")}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Account;
