import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileCode, Copy, CheckCircle } from "lucide-react";
import { usePreviewAclConfig } from "@/queries";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface PreviewConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreviewConfigDialog({ open, onOpenChange }: PreviewConfigDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data, isLoading, error } = usePreviewAclConfig();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (data?.config) {
      navigator.clipboard.writeText(data.config);
      setCopied(true);
      toast({
        title: t("acl.preview.copied"),
        description: t("preview.toast.copied"),
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            {t("acl.preview.title")}
          </DialogTitle>
          <DialogDescription>{t("acl.preview.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{t("acl.preview.loadFailed")}</AlertDescription>
            </Alert>
          )}

          {data && (
            <>
              <Alert>
                <AlertDescription>
                  {t("acl.preview.rulesBanner", { count: data.rulesCount })}
                </AlertDescription>
              </Alert>

              <div className="relative">
                <div className="absolute right-2 top-2 z-10">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopy}
                    className="gap-2"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        {t("acl.preview.copied")}
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        {t("acl.preview.copy")}
                      </>
                    )}
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[50vh] text-sm">
                  <code>{data.config}</code>
                </pre>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("acl.preview.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
