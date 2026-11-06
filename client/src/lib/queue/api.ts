/**
 * Client for the Express API (`/api/*`). Function names and shapes mirror the
 * old server functions, so components call `addToken({ data: { ... } })`.
 *
 * Failures the user can fix come back as `{ ok: false, error }`. A signed-out
 * caller throws `UnauthorizedError`.
 */

export type QueueSummary = {
  id: string;
  name: string;
  code: string;
  waiting: number;
  servingName: string | null;
  servingNumber: number | null;
  createdAt: string;
};

export type TokenRow = {
  id: string;
  number: number;
  personName: string;
  note: string;
  status: "waiting" | "serving" | "served" | "cancelled";
  position: number;
  createdAt: string;
  calledAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

export type Insights = {
  waitingNow: number;
  servingNow: number;
  served: number;
  cancelled: number;
  avgWaitSec: number | null;
  longestWaitSec: number | null;
  avgServiceSec: number | null;
  byQueue: {
    id: string;
    name: string;
    code: string;
    waiting: number;
    served: number;
    avgWaitSec: number | null;
  }[];
  bands: { label: string; count: number }[];
  trend: { at: string; waiting: number }[];
  recent: {
    id: string;
    personName: string;
    queueName: string;
    token: string;
    status: "served" | "cancelled";
    at: string;
    waitSec: number | null;
  }[];
};

type Ok<T extends object = object> = { ok: true } & T;
type Fail = { ok: false; error: string };

export type DeskProfile = {
  displayName: string | null;
  email: string | null;
  image: string | null;
};

export type DeskPayload =
  | { authed: false; queues: []; profile: DeskProfile }
  | { authed: true; queues: QueueSummary[]; profile: DeskProfile };

export const EMPTY_PROFILE: DeskProfile = { displayName: null, email: null, image: null };

export const SIGNED_OUT_DESK: DeskPayload = { authed: false, queues: [], profile: EMPTY_PROFILE };

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: unknown; status?: unknown; name?: unknown };
  return value.status === 401 || value.name === "UnauthorizedError" || value.message === "Unauthorized";
}

/** Send a request to the API and return its JSON. */
export async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: method === "GET" ? undefined : { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  if (response.status === 401) throw new UnauthorizedError();
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (json as { error?: unknown } | null)?.error;
    return { ok: false, error: typeof error === "string" ? error : "Something went wrong. Please try again." } as T;
  }
  return json as T;
}

const id = (value: string) => encodeURIComponent(value);

export const loadDesk = () => call<DeskPayload>("GET", "/desk");

export const createQueue = ({ data }: { data: { name: string; code: string } }) =>
  call<Ok<{ queue: QueueSummary }> | Fail>("POST", "/queues", data);

export const updateQueue = ({ data }: { data: { queueId: string; name: string; code: string } }) =>
  call<Ok<{ queue: { id: string; name: string; code: string } }> | Fail>("PATCH", `/queues/${id(data.queueId)}`, {
    name: data.name,
    code: data.code,
  });

export const deleteQueue = ({ data }: { data: { queueId: string } }) =>
  call<Ok | Fail>("DELETE", `/queues/${id(data.queueId)}`);

export const listTokens = ({ data }: { data: { queueId: string } }) =>
  call<TokenRow[] | Fail>("GET", `/queues/${id(data.queueId)}/tokens`);

export const addToken = ({ data }: { data: { queueId: string; personName: string; note: string } }) =>
  call<Ok<{ number: number; code: string }> | Fail>("POST", `/queues/${id(data.queueId)}/tokens`, {
    personName: data.personName,
    note: data.note,
  });

export const moveToken = ({ data }: { data: { tokenId: string; direction: "up" | "down" } }) =>
  call<Ok | Fail>("PATCH", `/tokens/${id(data.tokenId)}/position`, { direction: data.direction });

export const moveTokenTo = ({ data }: { data: { tokenId: string; toIndex: number } }) =>
  call<Ok | Fail>("PATCH", `/tokens/${id(data.tokenId)}/position`, { toIndex: data.toIndex });

export const callNext = ({ data }: { data: { queueId: string } }) =>
  call<Ok<{ called: { number: number; personName: string; code: string } | null }> | Fail>(
    "POST",
    `/queues/${id(data.queueId)}/call-next`,
  );

export const finishService = ({ data }: { data: { queueId: string } }) =>
  call<Ok<{ personName: string | null }> | Fail>("POST", `/queues/${id(data.queueId)}/finish`);

export const cancelToken = ({ data }: { data: { tokenId: string } }) =>
  call<Ok<{ personName: string }> | Fail>("POST", `/tokens/${id(data.tokenId)}/cancel`);

export const getInsights = ({ data }: { data: { range: "today" | "week"; tzOffsetMinutes: number } }) =>
  call<Insights>("GET", `/insights?range=${data.range}&tz=${data.tzOffsetMinutes}`);

export const loadSampleShift = () => call<Ok<{ queueId: string }> | Fail>("POST", "/demo");
