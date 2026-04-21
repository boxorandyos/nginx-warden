import { useState } from 'react';
import { Shield, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { WardenLogo } from '@/components/brand/WardenLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { authService } from '@/services/auth.service';
import { useAuthStorage } from '@/hooks/useAuthStorage';
import { useTranslation } from 'react-i18next';

interface ForcePasswordChangeProps {
  userId: string;
  tempToken: string;
  onPasswordChanged: (require2FASetup: boolean) => void;
}

export default function ForcePasswordChange({ userId, tempToken, onPasswordChanged }: ForcePasswordChangeProps) {
  const { t } = useTranslation();
  const { setAuth } = useAuthStorage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error(t('forcePassword.toast.requirements'));
      return;
    }

    if (!passwordsMatch) {
      toast.error(t('forcePassword.toast.mismatch'));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authService.changePasswordFirstLogin({
        userId,
        tempToken,
        newPassword,
      });

      setAuth(result.user, result.accessToken, result.refreshToken);

      toast.success(t('forcePassword.toast.success'));

      onPasswordChanged(result.require2FASetup);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || t('forcePassword.toast.failed');
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <WardenLogo collapsed className="justify-center" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('forcePassword.title')}</CardTitle>
          <CardDescription>{t('forcePassword.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">{t('forcePassword.alert')}</AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('forcePassword.labelNew')}</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('forcePassword.placeholderNew')}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('forcePassword.labelConfirm')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('forcePassword.placeholderConfirm')}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium">{t('forcePassword.requirementsTitle')}</p>
              <div className="space-y-1">
                <div className={`flex items-center gap-2 ${hasMinLength ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {hasMinLength ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span>{t('forcePassword.req.length')}</span>
                </div>
                <div className={`flex items-center gap-2 ${hasUpperCase ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {hasUpperCase ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span>{t('forcePassword.req.upper')}</span>
                </div>
                <div className={`flex items-center gap-2 ${hasLowerCase ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {hasLowerCase ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span>{t('forcePassword.req.lower')}</span>
                </div>
                <div className={`flex items-center gap-2 ${hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {hasNumber ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span>{t('forcePassword.req.number')}</span>
                </div>
                {confirmPassword && (
                  <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordsMatch ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>{t('forcePassword.req.match')}</span>
                  </div>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={!isPasswordValid || !passwordsMatch || isSubmitting}>
              {isSubmitting ? t('forcePassword.submitting') : t('forcePassword.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
