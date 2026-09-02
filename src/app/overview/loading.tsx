import { WorkspaceSkeleton } from "@/components/app/route-skeletons";

// Suspense fallback for this route segment — see route-skeletons.tsx for why
// this file exists. Next.js renders this the instant navigation starts, while
// the middleware's auth check and this page's Server Component are still in
// flight, instead of leaving the previous page frozen on screen.
export default function Loading() {
  return <WorkspaceSkeleton />;
}
