"use client";

import type { ComponentProps } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "../lib/cn";

/** Radix Tabs with the grey-track / white-active look. Compose: Tabs > TabsList > TabsTrigger + TabsContent. */
export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...rest }: ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-soft-bg p-1", className)}
      {...rest}
    />
  );
}

export function TabsTrigger({ className, ...rest }: ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "soft-focus cursor-pointer rounded-[9px] px-4 py-2 text-[13px] font-semibold text-soft-muted transition-all duration-150 hover:text-soft-ink data-[state=active]:bg-soft-surface data-[state=active]:text-soft-ink data-[state=active]:shadow-soft-sm disabled:opacity-50 max-[640px]:px-3",
        className,
      )}
      {...rest}
    />
  );
}

export function TabsContent({ className, ...rest }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn("soft-focus mt-4", className)} {...rest} />;
}
