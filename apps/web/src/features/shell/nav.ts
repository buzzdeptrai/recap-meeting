/** Sidebar structure (pure data; icons are mapped in `app-frame.tsx`). */
export type NavKey = "overview" | "meetings" | "glossary" | "usage" | "settings";

export interface NavSpec {
  key: NavKey;
  label: string;
  href: string;
}

export interface NavGroupSpec {
  label?: string;
  items: readonly NavSpec[];
}

export const NAV_SPEC: readonly NavGroupSpec[] = [
  { items: [{ key: "overview", label: "Tổng quan", href: "/" }] },
  {
    label: "Làm việc",
    items: [
      { key: "meetings", label: "Cuộc họp", href: "/meetings" },
      { key: "glossary", label: "Thuật ngữ", href: "/glossary" },
    ],
  },
  {
    label: "Quản trị",
    items: [
      { key: "usage", label: "Mức sử dụng", href: "/usage" },
      { key: "settings", label: "Cài đặt", href: "/settings" },
    ],
  },
];

const ROOM_PATH = /^\/meetings\/(?!new(?:\/|$))[^/]+\/?$/;

/**
 * The live room brings its own full-width top bar and two-pane layout, so it is rendered without
 * the sidebar frame ("bare" mode). Every other page sits inside the shell.
 */
export function isRoomPath(pathname: string | null | undefined): boolean {
  return typeof pathname === "string" && ROOM_PATH.test(pathname);
}
