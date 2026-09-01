'use client';

import { cn } from '@/lib/utils';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import * as React from 'react';

const PopoverRoot = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverPortal = PopoverPrimitive.Portal;
const PopoverPositioner = PopoverPrimitive.Positioner;

function PopoverContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Popup>) {
  return (
    <PopoverPortal>
      <PopoverPositioner sideOffset={8} collisionPadding={12}>
        <PopoverPrimitive.Popup
          className={cn(
            'z-50 min-w-[280px] rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-md',
            'origin-[var(--transform-origin)]',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'transition-[opacity,transform] duration-150 ease-out',
            className
          )}
          {...props}
        />
      </PopoverPositioner>
    </PopoverPortal>
  );
}

export { PopoverContent, PopoverRoot, PopoverTrigger };
