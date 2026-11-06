import { useEffect, useState } from "react";
import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadDesk, SIGNED_OUT_DESK, isUnauthorizedError, type DeskPayload, type DeskProfile } from "@/lib/queue/api";
import { DESK_QUERY_KEY, DeskStateProvider, fetchDesk } from "@/components/desk/desk-state";
import { Shell } from "@/components/desk/shell";

export const Route = createFileRoute("/_app")({
  staleTime: 30_000,
  loader: async (): Promise<DeskPayload> => {
    try {
      return await loadDesk();
    } catch (error) {
      if (isUnauthorizedError(error)) return SIGNED_OUT_DESK;
      throw error;
    }
  },
  component: DeskLayout,
});

function DeskLayout() {
  const loaderData = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const [seededAt] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const query = useQuery({
    queryKey: DESK_QUERY_KEY,
    queryFn: fetchDesk,
    initialData: loaderData.authed ? loaderData : undefined,
    initialDataUpdatedAt: loaderData.authed ? seededAt : undefined,
    staleTime: 15_000,
    refetchOnMount: loaderData.authed ? false : "always",
    refetchOnWindowFocus: false,
    enabled: loaderData.authed || mounted,
    refetchInterval: (current) => (current.state.data?.authed ? 20_000 : false),
  });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const fromQuery = query.data;
  const fromLoader = loaderData.authed ? loaderData : undefined;
  const resolved = fromQuery?.authed ? fromQuery : (fromLoader ?? fromQuery);
  const sessionProfile: DeskProfile | null = user
    ? {
        displayName: user.displayName,
        email: user.primaryEmail,
        image: user.profileImageUrl,
      }
    : null;
  const signedIn = Boolean(resolved?.authed || sessionProfile);

  if (!signedIn) {
    if (query.isError && !query.isFetching && !isPending) {
      return (
        <Shell profile={SIGNED_OUT_DESK.profile} queues={[]}>
          <p className="text-sm text-accent" role="alert">
            {query.error instanceof Error ? query.error.message : "Could not open the desk."}
          </p>
          <button type="button" className="btn btn-line mt-3" onClick={() => void query.refetch()}>
            Try again
          </button>
        </Shell>
      );
    }
    if (!mounted || isPending || query.isLoading) {
      return (
        <Shell profile={SIGNED_OUT_DESK.profile} queues={[]}>
          <p className="text-sm text-muted">Loading queues…</p>
        </Shell>
      );
    }
    return <SignedOut pathname={pathname} />;
  }

  const profile = resolved?.authed
    ? {
        displayName: resolved.profile.displayName ?? sessionProfile?.displayName ?? null,
        email: resolved.profile.email ?? sessionProfile?.email ?? null,
        image: resolved.profile.image ?? sessionProfile?.image ?? null,
      }
    : (sessionProfile as DeskProfile);
  const queues = resolved?.authed ? resolved.queues : [];
  const ready = Boolean(resolved?.authed);

  return (
    <DeskStateProvider value={{ authed: true, queues, profile, ready }}>
      <Shell profile={profile} queues={queues}>
        <Outlet />
      </Shell>
    </DeskStateProvider>
  );
}

function SignedOut({ pathname }: { pathname: string }) {
  if (pathname !== "/") return <Navigate to="/login" />;
  return <Outlet />;
}
