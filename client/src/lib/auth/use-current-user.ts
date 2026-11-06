import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "./client";

/** The signed-in manager, as the UI needs it. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
};

export type CurrentUserState = {
  /** `null` both while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving. Do not treat `null` as signed out yet. */
  isPending: boolean;
};

export const ME_QUERY_KEY = ["me"] as const;

/**
 * Current user plus loading state. Wait for `isPending` to clear before
 * redirecting on `user === null`, or signed-in managers bounce to the sign-in
 * page on every hard reload.
 */
export function useCurrentUserState(): CurrentUserState {
  const { data, isPending } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const user = useMemo<AppUser | null>(
    () => (data ? { id: data.id, displayName: data.name, primaryEmail: data.email, profileImageUrl: null } : null),
    [data],
  );
  return useMemo(() => ({ user, isPending }), [user, isPending]);
}
