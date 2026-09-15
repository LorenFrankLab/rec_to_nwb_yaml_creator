import { useEffect } from 'react';
import { registerDraft } from '../state/draftRegistry';

/**
 * Register an UNAPPLIED draft with the draft registry while `active` — an open setup dialog whose
 * edits only the user can apply (Save) or discard (Cancel). It arms the unsaved-work guard (the
 * leave-page prompt) but is never auto-flushed, since the decision is the user's.
 *
 * @param active - True while a dialog holds edits that have not been applied to the store.
 * @param label - Diagnostics label.
 */
export function useUnappliedDraftGuard(active: boolean, label = 'dialog'): void {
  useEffect(() => {
    if (!active) return undefined;
    return registerDraft({ isDirty: () => true, flush: null, label });
  }, [active, label]);
}
