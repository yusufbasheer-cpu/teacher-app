"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CornerDownLeft,
  Moon,
  Search,
  Sun,
  Monitor,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveLessonTitle } from "@/lib/lesson-plan";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/panel";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTheme } from "@/components/app/theme";
import { ACCOUNT_ITEMS, CREATE_ITEMS, LIBRARY_ITEMS, ROLE_ITEMS, type NavItem } from "@/lib/app-nav";

/**
 * Command palette (⌘K / Ctrl-K).
 *
 * The product had no global search and no keyboard path to anything: reaching
 * a saved lesson meant sidebar → My lessons → scan a card grid. For the target
 * user — a teacher who generates the same handful of things every week — the
 * palette is the fastest route to every destination and to their own content.
 *
 * Lessons are fetched once on first open and filtered client-side. The set is
 * small (a heavy user has tens, not thousands) so a round-trip per keystroke
 * would cost latency for no benefit.
 */

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ElementType;
  run: () => void;
  /** Extra text matched against the query but not displayed. */
  keywords?: string;
};

type SavedLesson = {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  chapter?: string | null;
  created_at: string;
};

export function CommandPalette({
  roles,
}: {
  roles: { schoolAdmin: boolean; hod: boolean; superAdmin: boolean };
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [lessons, setLessons] = React.useState<SavedLesson[] | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  /* ---- open/close ------------------------------------------------------ */
  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("layah:open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("layah:open-command-palette", onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
      return;
    }
    // Focus after paint so the dialog is mounted and the caret lands.
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  /* ---- lessons, fetched once on first open ----------------------------- */
  React.useEffect(() => {
    if (!open || lessons !== null) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setLessons([]);
        return;
      }
      const { data } = await supabase
        .from("saved_lessons")
        .select("id, subject, grade, topic, chapter, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) setLessons((data ?? []) as SavedLesson[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lessons]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  /* ---- command set ------------------------------------------------------ */
  const commands = React.useMemo<Cmd[]>(() => {
    const navCmd = (item: NavItem, group: string): Cmd => ({
      id: `nav:${item.href}`,
      label: item.label,
      hint: item.hint,
      group,
      icon: item.icon,
      run: () => go(item.href),
    });

    const roleItems: NavItem[] = [];
    if (roles.schoolAdmin) roleItems.push(ROLE_ITEMS.schoolAdmin);
    if (roles.hod) roleItems.push(ROLE_ITEMS.hod);
    if (roles.superAdmin) roleItems.push(ROLE_ITEMS.superAdmin);

    const lessonCmds: Cmd[] = (lessons ?? []).map((l) => ({
      id: `lesson:${l.id}`,
      label: resolveLessonTitle(l.topic, l.chapter, l.subject),
      hint: `${l.subject} · ${l.grade}`,
      group: "Lessons",
      icon: BookOpen,
      keywords: `${l.subject} ${l.grade} ${l.topic ?? ""} ${l.chapter ?? ""}`,
      run: () => go(`/my-lesson-plans/${l.id}`),
    }));

    return [
      ...CREATE_ITEMS.map((i) => navCmd(i, "Create")),
      ...LIBRARY_ITEMS.map((i) => navCmd(i, "Go to")),
      ...roleItems.map((i) => navCmd(i, "Go to")),
      ...ACCOUNT_ITEMS.map((i) => navCmd(i, "Go to")),
      ...lessonCmds,
      {
        id: "theme:light",
        label: "Light theme",
        group: "Theme",
        icon: Sun,
        keywords: "appearance colour color mode",
        run: () => {
          setTheme("light");
          setOpen(false);
        },
      },
      {
        id: "theme:dark",
        label: "Dark theme",
        group: "Theme",
        icon: Moon,
        keywords: "appearance colour color mode night",
        run: () => {
          setTheme("dark");
          setOpen(false);
        },
      },
      {
        id: "theme:system",
        label: "Match system theme",
        group: "Theme",
        icon: Monitor,
        keywords: "appearance colour color mode auto",
        run: () => {
          setTheme("system");
          setOpen(false);
        },
      },
    ];
  }, [go, lessons, roles, setTheme]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.filter((c) => c.group !== "Lessons").slice(0, 12);
    return commands
      .filter((c) => `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(q))
      .slice(0, 24);
  }, [commands, query]);

  React.useEffect(() => setActive(0), [query]);

  /* ---- keyboard within the palette -------------------------------------- */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[active]?.run();
    }
  };

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Group headings, preserving result order.
  const groups: { name: string; items: { cmd: Cmd; index: number }[] }[] = [];
  results.forEach((cmd, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === cmd.group) last.items.push({ cmd, index });
    else groups.push({ name: cmd.group, items: [{ cmd, index }] });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent initialFocus={inputRef} showCloseButton={false} className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[600px]">
        <DialogTitle className="sr-only">Search lessons and commands</DialogTitle>
        <DialogDescription className="sr-only">Type to search. Use arrow keys to select a result and Enter to open it.</DialogDescription>
        <div className="flex items-center gap-2.5 border-b border-line-subtle px-3.5">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search lessons, or jump to…"
            aria-label="Search lessons or run a command"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="command-results"
            aria-activedescendant={results[active] ? `command-result-${active}` : undefined}
            className="h-14 w-full bg-transparent text-base text-ink outline-none placeholder:text-faint"
          />
          <Kbd className="shrink-0">Esc</Kbd>
        </div>

        <div id="command-results" ref={listRef} className="max-h-[52vh] overflow-y-auto p-2" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-faint">
              Nothing matches “{query}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.name} className="mb-0.5">
                <p className="px-3 pb-2 pt-3 text-xs font-medium text-faint">
                  {group.name}
                </p>
                {group.items.map(({ cmd, index }) => {
                  const Icon = cmd.icon;
                  const isActive = index === active;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-index={index}
                      id={`command-result-${index}`}
                      tabIndex={-1}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => setActive(index)}
                      onClick={() => cmd.run()}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left",
                        isActive ? "bg-brand-subtle" : "bg-transparent",
                      )}
                    >
                      <Icon
                        className={cn("size-4 shrink-0", isActive ? "text-brand-text" : "text-faint")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{cmd.label}</span>
                        {cmd.hint ? (
                          <span className="mt-0.5 block truncate text-xs text-faint">{cmd.hint}</span>
                        ) : null}
                      </span>
                      {isActive ? (
                        <CornerDownLeft className="size-3.5 shrink-0 text-disabled" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line-subtle bg-surface px-3.5 py-2">
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            to move
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <ArrowRight className="size-3" aria-hidden />
            {lessons === null
              ? "Loading your lessons…"
              : `${lessons.length} lesson${lessons.length === 1 ? "" : "s"} searchable`}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
