'use client';

import { Calendar } from '@/components/ui/calendar';
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarDays } from 'lucide-react';
import * as React from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date to ISO "yyyy-MM-dd" for the parent prop contract */
function toIso(date: Date | null): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format an ISO "yyyy-MM-dd" string to user-facing "dd/mm/yyyy" for display */
function toDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; // pass through if unknown
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Parse a user-typed "dd/mm/yyyy" string into a Date. Returns null on failure. */
function parseDisplayDate(raw: string): Date | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return null;
  const [d, m, y] = raw.split('/');
  const date = new Date(`${y}-${m}-${d}`);
  return isNaN(date.getTime()) ? null : date;
}

/** Parse an ISO "yyyy-MM-dd" string into a Date. Returns null on failure. */
function parseIso(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRangePickerProps {
  /** ISO date string "yyyy-MM-dd" */
  from: string;
  /** ISO date string "yyyy-MM-dd" */
  to: string;
  onRangeChange: (from: string, to: string) => void;
  /** Override the outer container className (e.g. to remove border when used inside a form panel) */
  className?: string;
}

// ---------------------------------------------------------------------------
// Single Date Picker Input
// ---------------------------------------------------------------------------

interface DatePickerInputProps {
  id: string;
  label: string;
  /** ISO string "yyyy-MM-dd" */
  value: string;
  onChange: (isoDate: string) => void;
  onCalendarSelect: (date: Date) => void;
  selectedDate: Date | null;
  'data-testid'?: string;
}

function DatePickerInput({
  id,
  label,
  value,
  onChange,
  onCalendarSelect,
  selectedDate,
  ...rest
}: DatePickerInputProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  // Display format is dd/mm/yyyy; `value` prop is ISO yyyy-MM-dd
  const [inputValue, setInputValue] = React.useState(() => toDisplay(value));

  // Keep display input in sync when the ISO prop changes (e.g. from→to sync)
  React.useEffect(() => {
    setInputValue(toDisplay(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    // Only fire onChange when the user has typed a valid dd/mm/yyyy date
    const parsed = parseDisplayDate(raw);
    if (parsed) {
      onChange(toIso(parsed));
    }
  };

  const handleCalendarSelect = (date: Date) => {
    setInputValue(toDisplay(toIso(date)));
    onCalendarSelect(date);
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col w-full md:w-auto">
      <label
        htmlFor={id}
        className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 ml-1"
      >
        {label}
      </label>

      <div className="relative flex items-center">
        {/* Text Input */}
        <input
          id={id}
          type="text"
          placeholder="dd/mm/yyyy"
          value={inputValue}
          onChange={handleInputChange}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'h-10 pl-4 pr-10 bg-background border border-border rounded-lg text-sm font-medium outline-none transition-all w-full md:w-44',
            'focus:border-primary/50 focus:ring-4 focus:ring-primary/10',
            'hover:border-border hover:brightness-110',
            'text-foreground placeholder:text-muted-foreground/50'
          )}
          aria-label={`Type a date for ${label}`}
          data-testid={rest['data-testid']}
        />

        {/* Calendar Trigger */}
        <PopoverRoot open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
          <PopoverTrigger
            type="button"
            aria-label={`Open calendar for ${label}`}
            className={cn(
              'absolute right-2 flex h-6 w-6 items-center justify-center rounded-md',
              'text-muted-foreground transition-colors',
              'hover:text-primary hover:bg-primary/10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              isOpen && 'text-primary bg-primary/10'
            )}
          >
            <CalendarDays className="h-4 w-4" />
          </PopoverTrigger>

          <PopoverContent>
            <Calendar selected={selectedDate} onSelect={handleCalendarSelect} />
          </PopoverContent>
        </PopoverRoot>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DateRangePicker (exported)
// ---------------------------------------------------------------------------

/**
 * @desc A date range picker with dual Date Picker inputs (from / to).
 * Supports manual typing in "yyyy-MM-dd" format AND calendar selection.
 * Selecting a FROM date automatically syncs the TO date to the same value.
 *
 * @param from - ISO date string
 * @param to - ISO date string
 * @param onRangeChange - Callback with (from, to) ISO strings
 */
export function DateRangePicker({
  from,
  to,
  onRangeChange,
  className,
}: DateRangePickerProps) {
  const fromDate = parseIso(from);
  const toDate = parseIso(to);

  const handleFromChange = (isoDate: string) => {
    onRangeChange(isoDate, to);
  };

  const handleToChange = (isoDate: string) => {
    onRangeChange(from, isoDate);
  };

  // When FROM calendar is selected, sync TO to same date
  const handleFromCalendarSelect = (date: Date) => {
    const iso = toIso(date);
    onRangeChange(iso, iso);
  };

  const handleToCalendarSelect = (date: Date) => {
    const iso = toIso(date);
    onRangeChange(from, iso);
  };

  return (
    <div
      className={cn(
        'flex flex-col md:flex-row items-center gap-3 w-full justify-center',
        className
      )}
    >
      <DatePickerInput
        id="date-from"
        label="Start Date"
        value={from}
        onChange={handleFromChange}
        onCalendarSelect={handleFromCalendarSelect}
        selectedDate={fromDate}
        data-testid="date-from"
      />

      <div className="hidden md:block mt-5 h-px w-4 bg-border/60 shrink-0" />

      <DatePickerInput
        id="date-to"
        label="End Date"
        value={to}
        onChange={handleToChange}
        onCalendarSelect={handleToCalendarSelect}
        selectedDate={toDate}
        data-testid="date-to"
      />
    </div>
  );
}
