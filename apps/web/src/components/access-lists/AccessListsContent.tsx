import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { accessListsQueryOptions } from '@/queries/access-lists.query-options';
import { AccessListCard } from './AccessListCard';
import { AccessListFormDialog } from './AccessListFormDialog';
import { PaginationControls } from '@/components/ui/pagination-controls';

export function AccessListsContent() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [enabledFilter, setEnabledFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data } = useSuspenseQuery(
    accessListsQueryOptions({
      page,
      limit: 10,
      search: search || undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      enabled: enabledFilter === 'all' ? undefined : enabledFilter === 'true' ? true : false,
    })
  );

  const accessLists = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('accessLists.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder={t('accessLists.filterType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('accessLists.allTypes')}</SelectItem>
            <SelectItem value="ip_whitelist">{t('accessLists.type.ipWhitelist')}</SelectItem>
            <SelectItem value="http_basic_auth">{t('accessLists.type.httpBasic')}</SelectItem>
            <SelectItem value="combined">{t('accessLists.type.combined')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={enabledFilter} onValueChange={(value) => { setEnabledFilter(value); setPage(1); }}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder={t('accessLists.filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('accessLists.allStatus')}</SelectItem>
            <SelectItem value="true">{t('accessLists.status.enabled')}</SelectItem>
            <SelectItem value="false">{t('accessLists.status.disabled')}</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('accessLists.create')}
        </Button>
      </div>

      {accessLists.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg">
          <p className="text-muted-foreground mb-4">{t('accessLists.empty')}</p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('accessLists.createFirst')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {accessLists.map((accessList) => (
            <AccessListCard key={accessList.id} accessList={accessList} />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <PaginationControls
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}

      <AccessListFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
