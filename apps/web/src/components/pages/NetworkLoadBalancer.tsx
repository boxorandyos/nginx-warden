import { useState } from 'react';
import { useNLBs, useNLBStats, useDeleteNLB, useToggleNLB } from '@/queries/nlb.query-options';
import { NetworkLoadBalancer as NLBType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Activity,
  Network,
  Server,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import NLBFormDialog from '@/components/forms/NLBFormDialog';
import { useTranslation } from 'react-i18next';

export default function NetworkLoadBalancer() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedNLB, setSelectedNLB] = useState<NLBType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [nlbToDelete, setNlbToDelete] = useState<NLBType | null>(null);

  const { toast } = useToast();

  const { data, isLoading, error } = useNLBs({
    page,
    limit,
    search,
    status: statusFilter,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const { data: stats } = useNLBStats();
  const deleteMutation = useDeleteNLB();
  const toggleMutation = useToggleNLB();

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleEdit = (nlb: NLBType) => {
    setSelectedNLB(nlb);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (nlb: NLBType) => {
    setNlbToDelete(nlb);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!nlbToDelete) return;

    try {
      await deleteMutation.mutateAsync(nlbToDelete.id);
      toast({
        title: t('common.success'),
        description: t('nlb.toast.deleted', { name: nlbToDelete.name }),
      });
      setIsDeleteDialogOpen(false);
      setNlbToDelete(null);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.message || t('nlb.toast.deleteFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (nlb: NLBType) => {
    try {
      await toggleMutation.mutateAsync({
        id: nlb.id,
        enabled: !nlb.enabled,
      });
      toast({
        title: t('common.success'),
        description: t('nlb.toast.toggled', {
          name: nlb.name,
          state: !nlb.enabled ? t('nlb.state.enabled') : t('nlb.state.disabled'),
        }),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.message || t('nlb.toast.toggleFailed'),
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">{t('nlb.badge.active')}</Badge>;
      case 'inactive':
        return <Badge variant="secondary">{t('nlb.badge.inactive')}</Badge>;
      case 'error':
        return <Badge variant="destructive">{t('nlb.badge.error')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProtocolBadge = (protocol: string) => {
    switch (protocol) {
      case 'tcp':
        return <Badge variant="outline">TCP</Badge>;
      case 'udp':
        return <Badge variant="outline">UDP</Badge>;
      case 'tcp_udp':
        return <Badge variant="outline">TCP/UDP</Badge>;
      default:
        return <Badge variant="outline">{protocol}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('nlb.stats.total')}</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalNLBs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeNLBs} {t('common.active').toLowerCase()}, {stats.inactiveNLBs} {t('common.inactive').toLowerCase()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('nlb.stats.active')}</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeNLBs}</div>
              <p className="text-xs text-muted-foreground">{t('nlb.stats.activeHint')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('nlb.stats.totalUpstreams')}</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUpstreams}</div>
              <p className="text-xs text-muted-foreground">{t('nlb.stats.backendServers')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('nlb.stats.healthy')}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.healthyUpstreams}</div>
              <p className="text-xs text-muted-foreground">
                {t('nlb.stats.unhealthyCount', { count: stats.unhealthyUpstreams })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('nav.network')}</CardTitle>
          <CardDescription>{t('page.layer4.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('nlb.searchPlaceholder')}
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('nlb.create')}
            </Button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-8">{t('nlb.loading')}</div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              {t('nlb.loadError')}
            </div>
          ) : data && data.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('nlb.table.name')}</TableHead>
                    <TableHead>{t('nlb.table.port')}</TableHead>
                    <TableHead>{t('nlb.table.protocol')}</TableHead>
                    <TableHead>{t('nlb.table.algorithm')}</TableHead>
                    <TableHead>{t('nlb.table.upstreams')}</TableHead>
                    <TableHead>{t('nlb.table.status')}</TableHead>
                    <TableHead>{t('nlb.table.enabled')}</TableHead>
                    <TableHead className="text-right">{t('nlb.actions.label')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((nlb) => (
                    <TableRow key={nlb.id}>
                      <TableCell className="font-medium">{nlb.name}</TableCell>
                      <TableCell>{nlb.port}</TableCell>
                      <TableCell>{getProtocolBadge(nlb.protocol)}</TableCell>
                      <TableCell className="capitalize">
                        {nlb.algorithm.replace('_', ' ')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>{nlb.upstreams.length}</span>
                          <span className="text-muted-foreground text-xs">
                            {t('nlb.stats.upCount', { count: nlb.upstreams.filter((u) => u.status === 'up').length })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(nlb.status)}</TableCell>
                      <TableCell>
                        {nlb.enabled ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('nlb.actions.label')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEdit(nlb)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggle(nlb)}>
                              {nlb.enabled ? (
                                <>
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  {t('nlb.actions.disable')}
                                </>
                              ) : (
                                <>
                                  <Power className="mr-2 h-4 w-4" />
                                  {t('nlb.actions.enable')}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(nlb)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {t('pagination.showing', {
                      from: ((page - 1) * limit) + 1,
                      to: Math.min(page * limit, data.pagination.totalCount),
                      total: data.pagination.totalCount,
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={!data.pagination.hasPreviousPage}
                    >
                      {t('common.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={!data.pagination.hasNextPage}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('nlb.empty')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <NLBFormDialog
        isOpen={isCreateDialogOpen || isEditDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedNLB(null);
        }}
        nlb={selectedNLB}
        mode={isEditDialogOpen ? 'edit' : 'create'}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('nlb.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('nlb.delete.description', { name: nlbToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNlbToDelete(null)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
