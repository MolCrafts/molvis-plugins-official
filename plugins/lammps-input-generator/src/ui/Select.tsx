/**
 * Ergonomic wrapper over the SDK's compound Select.
 *
 * The six call sites all want the same shape — a labelled trigger showing the
 * current value, and a list of items — so they say `<Select value=… >` with
 * `<SelectItem>` children rather than assembling Trigger/Value/Content each
 * time.
 *
 * This used to import `@radix-ui/react-select` directly and restyle it. That
 * made Radix a bundled dependency of this plugin (124 kB of the bundle) and,
 * worse, gave the host a *second* Radix tree whenever this plugin loaded
 * alongside another — which `resolve.dedupe` cannot prevent, because it only
 * dedupes within a single bundle. The SDK's components are host-injected, so
 * composing them keeps one tree.
 */
import {
  Select as SelectRoot,
  SelectContent,
  SelectItem as SdkSelectItem,
  SelectTrigger,
  SelectValue,
} from "@molcrafts/molvis-plugin/ui";
import type { ReactNode } from "react";

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
    <SelectRoot value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </SelectRoot>
  );
}

export function SelectItem({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return <SdkSelectItem value={value}>{children}</SdkSelectItem>;
}
