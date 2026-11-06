import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  isUnauthorizedError,
  loadDesk,
  loadSampleShift,
  SIGNED_OUT_DESK,
  type DeskPayload,
} from "@/lib/queue/api";

export const DESK_QUERY_KEY = ["desk"] as const;

export async function fetchDesk(): Promise<DeskPayload> {
  try {
    return await loadDesk();
  } catch (error) {
    if (isUnauthorizedError(error)) return SIGNED_OUT_DESK;
    throw error;
  }
}

type AuthedDesk = Extract<DeskPayload, { authed: true }> & { ready: boolean };

const DeskContext = createContext<AuthedDesk | null>(null);

export function DeskStateProvider({ value, children }: { value: AuthedDesk; children: ReactNode }) {
  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk() {
  const value = useContext(DeskContext);
  if (!value) throw new Error("Desk state is only available once the manager is signed in.");
  return value;
}

export function useOptionalDesk() {
  return useContext(DeskContext);
}

export function useRefreshDesk() {
  const queryClient = useQueryClient();
  return (queueId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: DESK_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: queueId ? ["tokens", queueId] : ["tokens"] }),
      queryClient.invalidateQueries({ queryKey: ["insights"] }),
    ]);
}

export function useSampleShift() {
  const refresh = useRefreshDesk();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      const result = await loadSampleShift();
      if (!result.ok) throw new Error(result.error);
      return result.queueId;
    },
    onSuccess: async (queueId) => {
      toast.success("Demo data loaded. Your existing queues were left in place.");
      await refresh();
      await navigate({ to: "/queues/$queueId", params: { queueId } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not load the demo data."),
  });
}
