'use client';

import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Returns the number of days in a given month/year */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns the weekday index (0=Sun) of the 1st of the month */
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export interface CalendarProps {
  /** The currently selected date (or null) */
  selected: Date | null;
  /** Callback when a day is selected */
  onSelect: (date: Date) => void;
  className?: string;
}

/**
 * @desc A fully self-contained calendar grid component.
 * Does not depend on `react-day-picker` or `date-fns`.
 * @example
 * <Calendar selected={date} onSelect={(d) => setDate(d)} />
 */
export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = React.useState(
    selected ? selected.getFullYear() : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = React.useState(
    selected ? selected.getMonth() : today.getMonth()
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOffset = getFirstDayOfMonth(viewYear, viewMonth);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isSelected = (day: number) => {
    if (!selected) return false;
    return (
      selected.getFullYear() === viewYear &&
      selected.getMonth() === viewMonth &&
      selected.getDate() === day
    );
  };

  const isToday = (day: number) => {
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    );
  };

  const cells: React.ReactNode[] = [];

  // Empty leading cells
  for (let i = 0; i < firstDayOffset; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const d = day;
    cells.push(
      <button
        key={`day-${d}`}
        type="button"
        onClick={() => onSelect(new Date(viewYear, viewMonth, d))}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-150 outline-none',
          'hover:bg-primary/20 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50',
          isSelected(d) && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
          isToday(d) && !isSelected(d) && 'text-primary font-bold ring-1 ring-primary/40',
          !isSelected(d) && !isToday(d) && 'text-foreground/80'
        )}
        aria-label={`${MONTHS[viewMonth]} ${d}, ${viewYear}`}
        aria-pressed={isSelected(d)}
      >
        {d}
      </button>
    );
  }

  return (
    <div className={cn('p-3 select-none', className)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="flex h-8 items-center justify-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells}
      </div>
    </div>
  );
}
