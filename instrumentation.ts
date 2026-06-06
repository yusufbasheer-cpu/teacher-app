/**
 * Next.js instrumentation hook — initialises Sentry on the server and edge runtimes.
 * The client runtime is initialised separately by sentry.client.config.ts.
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Forward uncaught request errors to Sentry.
 * Called by Next.js 15+ when an error propagates out of a Server Component or API route.
 */
export async function onRequestError(
  err: { digest?: string } & Error,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(err, {
    extra: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    },
  });
}
