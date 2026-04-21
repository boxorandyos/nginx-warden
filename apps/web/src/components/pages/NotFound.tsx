import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{t("notFound.title")}</h1>
        <p className="mb-4 text-xl text-gray-600">{t("notFound.heading")}</p>
        <Link to="/" className="text-blue-500 underline hover:text-blue-700">
          {t("notFound.linkHome")}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
