/**
 * Wire envelope for `molvis_rpc_reply` (host → kernel worker).
 *
 * **Every key is always present**; `payload` / `error` are `null` when they do
 * not apply. The reader is Python holding a `JsProxy`, where a missing key
 * raises `AttributeError` rather than yielding a default — so an omitted key
 * is an exception mid-handler, and the pending future never resolves.
 *
 * Build replies only through these two constructors.
 */

export type RpcReply = {
  readonly type: "molvis_rpc_reply";
  readonly id: string;
  readonly ok: boolean;
  readonly payload: unknown;
  readonly error: string | null;
};

/** Success. `payload` is `null` for void commands, never absent. */
export function rpcSuccess(id: string, payload: unknown): RpcReply {
  return {
    type: "molvis_rpc_reply",
    id,
    ok: true,
    payload: payload === undefined ? null : payload,
    error: null,
  };
}

/** Failure. `payload` stays present (null) so the shape never varies. */
export function rpcFailure(id: string, err: unknown): RpcReply {
  return {
    type: "molvis_rpc_reply",
    id,
    ok: false,
    payload: null,
    error: err instanceof Error ? err.message : String(err),
  };
}

/** Keys every reply must carry. */
export const RPC_REPLY_KEYS = [
  "type",
  "id",
  "ok",
  "payload",
  "error",
] as const;
