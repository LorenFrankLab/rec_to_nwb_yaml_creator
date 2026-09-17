/** Result returned by a state mutation or draft writer. */
export type CommitResult =
  | { accepted: true }
  | { accepted: false; reason: string; error?: unknown };

/** Legacy writers may still return void; void means the call completed without rejecting. */
export type CommitResponse = void | boolean | CommitResult;

export const ACCEPTED_COMMIT: CommitResult = Object.freeze({ accepted: true });

/** Normalize old and new writer contracts at the draft boundary. */
export function normalizeCommitResponse(response: CommitResponse): CommitResult {
  if (response === false) return { accepted: false, reason: 'The edit was not accepted.' };
  if (response && typeof response === 'object' && 'accepted' in response) return response;
  return ACCEPTED_COMMIT;
}

/** Turn an exception into a rejected result without discarding its diagnostic value. */
export function rejectedCommit(error: unknown): Extract<CommitResult, { accepted: false }> {
  const reason = error instanceof Error && error.message
    ? error.message
    : 'The edit could not be saved.';
  return { accepted: false, reason, error };
}
