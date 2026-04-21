import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export const UnderConstructionBanner = () => {
  const { t } = useTranslation();
  return (
    <Alert className="mb-6 bg-primary/10 border-primary/20 text-primary dark:bg-primary/5 dark:border-primary/15">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{t("banner.underConstruction")}</AlertDescription>
    </Alert>
  );
};