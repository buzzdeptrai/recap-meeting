"use client";

import { createContext, useContext, type AnchorHTMLAttributes } from "react";
import { defaultLabels, type Labels } from "../labels";
import type { ShellLinkComponent } from "./types";

export interface ShellContextValue {
  Link: ShellLinkComponent;
  collapsed: boolean;
  /** Close the mobile drawer (called after navigating). */
  closeDrawer: () => void;
  labels: Labels;
}

const DefaultLink: ShellLinkComponent = (
  props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string },
) => <a {...props} />;

export const ShellContext = createContext<ShellContextValue>({
  Link: DefaultLink,
  collapsed: false,
  closeDrawer: () => {},
  labels: defaultLabels,
});

export const useShell = () => useContext(ShellContext);
export { DefaultLink };
