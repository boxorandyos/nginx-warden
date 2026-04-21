import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatTimezoneChoice, getIanaTimeZoneIds } from '@/lib/timezones';

type TimezoneSelectProps = {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
  id?: string;
  /** Shown when `value` is empty */
  placeholder: string;
};

export function TimezoneSelect({ value, onChange, disabled, id, placeholder }: TimezoneSelectProps) {
  const { i18n, t } = useTranslation();
  const locale = i18n.language;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const ids = useMemo(() => getIanaTimeZoneIds(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ids;
    return ids.filter((z) => z.toLowerCase().includes(q));
  }, [ids, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            'flex h-9 w-full min-w-0 justify-between gap-2 font-normal shadow-xs',
            !value && 'text-muted-foreground'
          )}
        >
          <span className="truncate text-left text-sm">
            {value ? formatTimezoneChoice(value, locale) : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,26rem)] p-0" align="start">
        <div className="border-b border-border p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('account.profile.timezoneSearch')}
            className="h-9"
            autoComplete="off"
          />
        </div>
        <ScrollArea className="h-[min(17.5rem,50vh)]">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t('account.profile.timezoneNoResults')}
            </p>
          ) : (
            <div className="p-1">
              {filtered.map((tz) => {
                const selected = tz === value;
                return (
                  <button
                    key={tz}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                      selected && 'bg-accent'
                    )}
                    onClick={() => {
                      onChange(tz);
                      setOpen(false);
                    }}
                  >
                    <span className="flex w-4 shrink-0 justify-center">
                      {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{tz}</span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
