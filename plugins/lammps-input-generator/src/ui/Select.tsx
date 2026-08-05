import * as SelectPrimitive from "@radix-ui/react-select";
import type { ReactNode } from "react";

const triggerClass =
  "flex h-control-compact w-full items-center justify-between gap-2 whitespace-nowrap rounded-control border border-input bg-transparent px-3 text-body outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
const contentClass =
  "motion-anchored-surface relative z-50 min-w-menu max-h-[var(--radix-select-content-available-height)] overflow-y-auto rounded-overlay border bg-popover text-popover-foreground shadow-overlay";
const itemClass =
  "relative flex w-full cursor-default select-none items-center rounded-control py-1 pr-8 pl-2 text-body outline-none focus:bg-interactive focus:text-interactive-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export function Select({
  value,
  onValueChange,
  children,
  ariaLabel,
  className = "",
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        aria-label={ariaLabel}
        className={`${triggerClass} ${className}`}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon aria-hidden="true" className="text-muted-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          align="start"
          sideOffset={4}
          className={contentClass}
        >
          <SelectPrimitive.Viewport className="min-w-[var(--radix-select-trigger-width)] p-1">
            {children}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <SelectPrimitive.Item data-slot="select-item" value={value} className={itemClass}>
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
