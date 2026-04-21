import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useLocation } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';

interface DashboardHeaderProps {
  title?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}

export function DashboardHeader({ title, breadcrumbs }: DashboardHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const generateBreadcrumbs = () => {
    if (breadcrumbs) return breadcrumbs;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const builtBreadcrumbs: Array<{ label: string; href?: string }> = [];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      builtBreadcrumbs.push({
        label: t(`nav.${segment}`, segment.charAt(0).toUpperCase() + segment.slice(1)),
        href: isLast ? undefined : currentPath,
      });
    });

    return builtBreadcrumbs;
  };

  const generatedBreadcrumbs = generateBreadcrumbs();

  return (
    <header className="shrink-0 border-b border-foreground/10 bg-muted/20 px-4 py-3 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Breadcrumb>
          <BreadcrumbList className="rounded-none sm:gap-2">
            {generatedBreadcrumbs.map((item, index) => (
              <Fragment key={`${item.label}-${index}`}>
                <BreadcrumbItem>
                  {item.href ? (
                    <Link to={item.href}>
                      <BreadcrumbLink className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
                        {item.label}
                      </BreadcrumbLink>
                    </Link>
                  ) : (
                    <BreadcrumbPage className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                      {item.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < generatedBreadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="px-0.5 text-muted-foreground/60">/</BreadcrumbSeparator>
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        {title && (
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground md:block">{title}</p>
        )}
      </div>
    </header>
  );
}
