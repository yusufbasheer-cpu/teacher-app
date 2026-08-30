import { Skeleton } from "@/components/ui/panel";

/**
 * Route-level pending shapes, one per page family.
 *
 * These back the `loading.tsx` Suspense boundary for every authenticated
 * route. That boundary is the actual fix for the "click → freeze → page"
 * feeling reported in the sidebar: every route here is `force-dynamic` and
 * its Server Component calls `getVerifiedUser()`, and the middleware in
 * front of it (`src/proxy.ts`) makes a real network call to Supabase's auth
 * server on every navigation to verify the session. That round-trip is
 * unavoidable if the identity check is going to mean anything — but without
 * a `loading.tsx`, Next.js has nothing to paint while it's in flight, so the
 * old page just sits there until the new one snaps in.
 *
 * With this in place, Next shows the matching shape the instant navigation
 * starts — before the RSC response exists at all — so the perceived latency
 * drops from "the click did nothing" to "the page is already loading."
 *
 * Each shape matches its real page's own dimensions (checked against the
 * live components) so there is no visible jump when real content replaces
 * the skeleton.
 */

function Shell({ children, maxW = 1100 }: { children: React.ReactNode; maxW?: number }) {
  return (
    <div
      className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8"
      style={{ maxWidth: maxW }}
      aria-hidden
    >
      {children}
    </div>
  );
}

/** Lesson plan / question paper / worksheet pack composers. */
export function ComposerSkeleton() {
  return (
    <Shell>
      <Skeleton className="h-6 w-40" />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[420px] rounded-lg" />
        <Skeleton className="h-[280px] rounded-lg" />
      </div>
    </Shell>
  );
}

/** Dashboard — greeting, start-a-lesson panel, recent list. */
export function WorkspaceSkeleton() {
  return (
    <Shell maxW={1080}>
      <Skeleton className="mb-5 h-6 w-52" />
      <Skeleton className="h-[188px] w-full rounded-lg" />
      <Skeleton className="mt-6 h-4 w-32" />
      <Skeleton className="mt-2 h-[140px] w-full rounded-lg" />
    </Shell>
  );
}

/** My lessons — title/action row, toolbar, list panel. */
export function ListSkeleton() {
  return (
    <Shell maxW={1080}>
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <Skeleton className="mt-5 h-8 w-64 rounded-md" />
      <Skeleton className="mt-4 h-[280px] rounded-lg" />
    </Shell>
  );
}

/** Settings — stacked account panels. */
export function SettingsSkeleton() {
  return (
    <Shell maxW={720}>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-5 h-[132px] rounded-lg" />
      <Skeleton className="mt-4 h-[96px] rounded-lg" />
      <Skeleton className="mt-4 h-[96px] rounded-lg" />
    </Shell>
  );
}

/** Saved-lesson detail — breadcrumb row, details disclosure, package viewer. */
export function DetailSkeleton() {
  return (
    <Shell maxW={1180}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-11 rounded-lg" />
      <Skeleton className="mt-4 h-6 w-48" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-[320px] rounded-lg" />
        <Skeleton className="h-[480px] rounded-lg" />
      </div>
    </Shell>
  );
}
