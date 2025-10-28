# M5 Day Editor Stepper Design Review

**Date:** 2025-10-28
**Reviewers:** code-reviewer, ux-reviewer, ui-designer (subagents)
**Status:** NEEDS_REVISION - Address P0 issues before implementation

---

## Executive Summary

The M5 Day Editor Stepper design demonstrates solid architectural foundations with strong accessibility planning and appropriate workflow patterns for scientific metadata editing. However, **critical integration gaps** in store communication, validation state management, and data merging must be resolved before implementation begins.

**Overall Ratings:**

- **Code Architecture:** 4.2/5 - Well-structured but critical integration gaps
- **User Experience:** 4.0/5 - Strong workflow but edge cases need handling
- **Visual Design:** 3.5/5 - Good structure but inconsistent with existing system

**Recommendation:** REQUEST_CHANGES - Resolve all P0 issues, address P1 concerns, document P2 enhancements for future iterations.

---

## Code Review (4.2/5)

### Strengths

- ✅ Clean component hierarchy (Container/Presentational separation)
- ✅ Accessibility-first approach (ARIA live regions, keyboard nav)
- ✅ Reuses existing validation patterns
- ✅ Testable architecture with clear separation of concerns
- ✅ Auto-save design prevents data loss

### Critical Issues (P0 - Blocking)

#### P0.1: Store Integration Mismatch

**Problem:** Design assumes direct field updates, but `updateDay()` requires **full object replacement** for nested fields.

**Current updateDay API:**

```javascript
actions.updateDay('remy-2023-06-22', {
  session: { session_id: 'new_value' }  // Replaces entire session object
})
```

**Design assumes:**

```javascript
handleFieldUpdate('session.session_id', 'new_value')
```

**Impact:** This will cause sibling fields to be lost on every update.

**Fix Required:**

```javascript
const handleFieldUpdate = useCallback((fieldPath, value) => {
  const day = model.workspace.days[dayId];
  if (!day) return;

  // Parse path: "session.session_id" → ["session", "session_id"]
  const pathSegments = fieldPath.split('.');

  // Clone day and update nested field
  const updated = structuredClone(day);
  let target = updated;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    target = target[pathSegments[i]];
  }
  target[pathSegments[pathSegments.length - 1]] = value;

  // Update via store
  actions.updateDay(dayId, {
    session: updated.session,
    // Include other top-level keys as needed
  });
}, [dayId, model.workspace.days, actions]);
```

---

#### P0.2: Validation State Management Unclear

**Problem:** Design doesn't specify **where validation state lives** or **when it's computed**.

**Evidence:** Store already has `day.state.validationErrors` field but design doesn't use it!

**Fix Required:** Use store-backed validation:

```javascript
// On field blur
const issues = validateField(mergedDay, fieldPath);
actions.updateDay(dayId, {
  state: {
    ...day.state,
    validationErrors: issues
  }
});

// In StepNavigation
const stepStatus = useMemo(() => {
  const errors = day.state.validationErrors || [];
  // Group errors by step...
}, [day.state.validationErrors]);
```

---

#### P0.3: Animal/Day Data Merging Not Implemented

**Problem:** Validation requires full NWB object, but merge function doesn't exist.

**Fix Required:** Implement `mergeDayMetadata(animal, day)` utility in `/src/state/workspaceUtils.js`:

```javascript
/**
 * Merges animal defaults with day-specific data to create NWB metadata object
 *
 * @param {Animal} animal - Parent animal
 * @param {Day} day - Recording day
 * @returns {object} NWB metadata object for YAML export/validation
 */
export function mergeDayMetadata(animal, day) {
  return {
    // Animal defaults
    subject: animal.subject,
    experimenter_name: animal.experimenters.experimenter_name,
    lab: animal.experimenters.lab,
    institution: animal.experimenters.institution,

    // Devices (with day overrides)
    data_acq_device: day.deviceOverrides?.data_acq_device || animal.devices.data_acq_device,
    electrode_groups: day.deviceOverrides?.electrode_groups || animal.devices.electrode_groups,
    cameras: day.deviceOverrides?.cameras || animal.cameras,

    // Day-specific data
    ...day.session,
    tasks: day.tasks,
    behavioral_events: day.behavioral_events,
    associated_files: day.associated_files,

    // Technical params
    times_period_multiplier: day.technical.times_period_multiplier,
    raw_data_to_volts: day.technical.raw_data_to_volts,
    default_header_file_path: day.technical.default_header_file_path,
    units: day.technical.units,

    // Optogenetics (if present)
    ...(animal.optogenetics && {
      opto_excitation_source: animal.optogenetics.opto_excitation_source,
      optical_fiber: animal.optogenetics.optical_fiber,
      virus_injection: animal.optogenetics.virus_injection,
    }),
  };
}
```

---

#### P0.4: Missing DayId Resolution

**Problem:** Design doesn't specify how `DayEditorStepper` receives `dayId` from URL.

**Fix Required:** Implement URL param parsing:

```javascript
// New hook in /src/hooks/useDayIdFromUrl.js
export function useDayIdFromUrl() {
  const [dayId, setDayId] = useState(null);

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/#\/day\/(.+)/);
    setDayId(match ? match[1] : null);
  }, []);

  return dayId;
}
```

---

### Should Fix Issues (P1)

#### P1.1: Performance - Re-render Optimization Missing

Use `React.memo` with custom comparison to prevent unnecessary re-renders:

```javascript
const OverviewStep = memo(({ day, animalDefaults, onFieldUpdate }) => {
  // ... implementation
}, (prev, next) => {
  return prev.day.lastModified === next.day.lastModified;
});
```

#### P1.2: Type Safety - PropTypes Missing

Add JSDoc + PropTypes for all new components (matches M0.5 strategy).

#### P1.3: Error Handling - Network/Store Errors Unhandled

Wrap store updates in try-catch with user-friendly error messages.

#### P1.4: Accessibility - ARIA Announcements for Save Status

Use `aria-live="polite"` (not assertive) and debounce announcements.

#### P1.5: Validation Feedback - Field-to-Error Mapping

Specify how validation errors map to input elements using `aria-describedby`.

---

## UX Review (4.0/5)

### Strengths

- ✅ Clear information hierarchy (inherited vs. editable fields)
- ✅ Auto-save appropriate for scientific workflow
- ✅ Non-intrusive validation (wait-until-blur)
- ✅ Strong accessibility foundation (ARIA, keyboard nav)
- ✅ Progressive disclosure via stepper

### Critical Issues (P0)

#### P0.1: Auto-Save Conflict Resolution Missing

**Problem:** Two browser tabs editing same day creates race condition.

**Fix Required:** Implement conflict detection on visibility change:

```javascript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const stored = localStorage.getItem(`day_${animalId}_${date}`);
      const storedData = JSON.parse(stored);

      if (storedData.lastModified > currentData.lastModified) {
        showConflictDialog({
          yours: currentData,
          stored: storedData,
          onResolve: (choice) => { /* 'keep-yours' | 'use-stored' | 'review-diff' */ }
        });
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [currentData]);
```

---

#### P0.2: Validation State During Navigation Unclear

**Problem:** User fills invalid field, immediately navigates to next step - what happens?

**Fix Required:** Non-blocking navigation with persistent error summary:

- Allow navigation to any step
- Show error count badge on steps with issues: "1. Overview ⚠️2"
- On Export step, show full error summary with "Go to [Step]" links

---

#### P0.3: No Recovery Path for localStorage Full

**Problem:** `localStorage.setItem()` can throw `QuotaExceededError`.

**Fix Required:** Graceful degradation with user notification:

```javascript
const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return { success: true };
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // Clear old day data (keep only last 20 edited days)
      // ... cleanup logic
      showNotification('Auto-save cleaned up old data to make room', 'info');
    }
    return { success: false, error: e.name };
  }
};
```

---

#### P0.4: Screen Reader Step Status Not Redundantly Encoded

**Problem:** Unicode icons (✓ ⚠ ✗) without text alternatives.

**Fix Required:** Use visually hidden text + aria-label:

```jsx
<a
  href="#overview"
  aria-current="step"
  aria-label="Overview - Complete"
>
  <span className="step-status" aria-hidden="true">✓</span>
  <span className="sr-only">Complete</span>
</a>
```

---

### Should Fix Issues (P1)

#### P1.1: Save Status Ambiguity During Slow Saves

Separate validation status from save status to avoid confusion.

#### P1.2: Navigation Away During Save Not Handled

Flush pending debounced saves on navigation.

#### P1.3: Inherited Field "Edit Animal" Link Has Unclear Scope

Add confirmation if unsaved changes exist before navigating.

#### P1.4: No Keyboard Shortcut Documentation

Add keyboard shortcut help overlay.

#### P1.5: Error Recovery Guidance Weak

Provide format examples in error messages.

#### P1.6: No Indication of Required vs Optional Fields

Use asterisk notation for required fields.

---

### WCAG 2.1 Level AA Compliance

| Criterion | Status | Action Required |
|-----------|--------|-----------------|
| 1.4.3 Contrast (Minimum) | ⚠️ UNKNOWN | Verify stepper colors, error text |
| 2.1.2 No Keyboard Trap | ⚠️ RISK | Ensure modal dialogs allow Esc |
| 2.4.7 Focus Visible | ⚠️ UNKNOWN | Specify focus indicator styles |
| 3.3.2 Labels or Instructions | ⚠️ NEEDS FIX | Add required field indicators |
| 3.3.3 Error Suggestion | ⚠️ NEEDS FIX | Improve error messages with examples |
| 4.1.2 Name, Role, Value | ⚠️ NEEDS FIX | Redundantly encode step status |

---

## UI Design Review (3.5/5)

### Strengths

- ✅ Clear three-tier hierarchy (Header → Navigation → Content)
- ✅ Consistent with existing button/status chip patterns
- ✅ Strong read-only differentiation (grey bg + lock icon)
- ✅ Thoughtful accessibility foundation

### Critical Issues (P0)

#### P0.1: Color Palette Mismatch

**Problem:** Proposed colors don't match existing design system.

**Current System:**

```css
Primary: #2196f3  (not #0066cc)
Success: #2e7d32  (not #28a745)
Warning: #e65100  (not #ffc107)
Error: #d32f2f    (not #dc3545)
```

**Fix Required:** Use Material Design-inspired palette from AnimalWorkspace.

---

#### P0.2: Missing CSS Class Definitions

**Problem:** Classes like `.step-navigation`, `.save-indicator` don't exist in codebase.

**Fix Required:** Create complete `DayEditor.css` with all component styles before implementation.

---

#### P0.3: Typography System Not Defined

**Current System:**

- h2: 1.2rem - 1.3rem (section headings)
- Body: 1rem (default)
- Small: 0.875rem (secondary info)

**Fix Required:** Use 1.5rem for h1, 1.2rem for h2, standardize on system font stack.

---

### Should Fix Issues (P1)

#### P1.1: Stepper Navigation Visual Design Unclear

Missing interaction states (disabled, completed, error, hover, focus).

**Recommendation:**

```css
.step-item.current button {
  border-bottom-color: #2196f3;
  background-color: #e3f2fd;
  font-weight: 600;
}

.step-item.completed button {
  color: #2e7d32;
}

.step-item.error button {
  color: #d32f2f;
}

.step-item button:focus {
  outline: 2px solid #2196f3;
  outline-offset: 2px;
}
```

---

#### P1.2: SaveIndicator Placement Conflicts with Accessibility

Position inside `<header>` with flexbox, not absolute positioning.

#### P1.3: Icon Choice Not Validated

Unicode emoji (🔒, ⟳, ✓) may not render consistently. Use SVG with ARIA labels or text-only.

#### P1.4: Validation Error Display Strategy Undefined

Leverage existing `HintDisplay` component from `/src/validation/HintDisplay.jsx`.

#### P1.5: Read-Only Field Implementation Lacks Consistency

Add `disabled` and `readOnly` attributes, not just visual styling.

---

### Nice to Have (P2)

#### P2.1: Spacing System Could Be More Semantic

Define CSS custom properties for design tokens.

#### P2.2: Responsive Design Not Addressed

Implement mobile-first approach with vertical stepper on small screens.

#### P2.3: Animation/Transition Strategy Missing

Standardize on Material Design timing (150ms, 250ms, 400ms).

---

## Action Items Before Implementation

### Must Complete (P0 - Blocking)

**Code:**

- [ ] Implement `handleFieldUpdate()` with proper nested object updates
- [ ] Define validation state caching strategy (store-backed)
- [ ] Create `mergeDayMetadata()` utility in workspaceUtils.js
- [ ] Implement `useDayIdFromUrl()` hook
- [ ] Add error handling with try-catch for all store operations

**UX:**

- [ ] Implement auto-save conflict detection
- [ ] Design validation state during navigation flow
- [ ] Add localStorage quota error handling
- [ ] Fix screen reader step status announcements (redundant encoding)

**UI:**

- [ ] Create complete `DayEditor.css` with all component styles
- [ ] Update color palette to match existing system (#2196f3, etc.)
- [ ] Define typography hierarchy
- [ ] Choose icon implementation strategy (SVG recommended)

---

### Should Complete (P1 - Important)

**Code:**

- [ ] Add React.memo with custom comparison for performance
- [ ] Add PropTypes + JSDoc to all components
- [ ] Implement field-to-error mapping with aria-describedby

**UX:**

- [ ] Separate save/validation status indicators
- [ ] Flush pending saves on navigation
- [ ] Add "Edit Animal" link confirmation dialog
- [ ] Add keyboard shortcut help
- [ ] Improve error messages with examples
- [ ] Add required field indicators (asterisks)

**UI:**

- [ ] Define all stepper states (current, completed, error, disabled, hover, focus)
- [ ] Position SaveIndicator in header flexbox
- [ ] Add global validation error styles
- [ ] Implement read-only fields with disabled + readOnly attributes

---

### Nice to Have (P2 - Future)

- [ ] CSS custom properties for design tokens
- [ ] Responsive breakpoints for mobile
- [ ] Standard transition timing
- [ ] Keyboard navigation tests
- [ ] WCAG color contrast verification

---

## Test Strategy

### Integration Test Priority

Create integration test for critical flow before implementation:

```javascript
describe('DayEditorStepper Integration', () => {
  it('loads day from store and merges with animal defaults', async () => {
    // 1. Create animal + day in store
    // 2. Navigate to day editor
    // 3. Verify merged data displays correctly
    // 4. Verify inherited fields are read-only
  });

  it('saves field updates to store on blur', async () => {
    // 1. Type in session_id field
    // 2. Blur field
    // 3. Verify store.days[dayId].session.session_id updated
    // 4. Verify no sibling fields lost
  });

  it('validates merged data and shows errors', async () => {
    // 1. Enter invalid session_id
    // 2. Blur field
    // 3. Verify inline error displayed
    // 4. Verify day.state.validationErrors updated
  });

  it('updates navigation status when validation changes', async () => {
    // 1. Fix validation error
    // 2. Verify step status changes from ✗ to ✓
  });

  it('prevents navigation to Export until valid', async () => {
    // 1. Attempt to click Export step
    // 2. Verify button disabled
    // 3. Fix all errors
    // 4. Verify Export enabled
  });
});
```

---

## File Size Estimates

| File | Estimated Lines | Justification |
|------|----------------|---------------|
| DayEditorStepper.jsx | 200-250 | Similar to AnimalWorkspace (189) + merging logic |
| OverviewStep.jsx | 150-200 | 5-8 fields, simpler than LegacyFormView sections |
| StepNavigation.jsx | 80-100 | Navigation component |
| SaveIndicator.jsx | 40-60 | Simple status display |
| validation.js | 100-150 | Validation caching + step status |
| ReadOnlyField.jsx | 30-40 | Simple presentational component |
| DayEditor.css | 150-200 | Stepper, form, navigation styles |

**Total:** ~850-1000 lines (reasonable for M5 scope)

---

## Final Recommendations

### Proceed to Implementation: YES, with conditions

**Conditions:**

1. ✅ Resolve all P0 issues (estimated 4-6 hours design revision)
2. ✅ Create `mergeDayMetadata()` utility first (testable in isolation)
3. ✅ Write integration test for critical flow
4. ✅ Add PropTypes to all new components
5. ✅ Document error handling strategy

**Timeline Impact:** +1 day for P0 fixes, then 2-3 days implementation

**Risk Level:** Medium → Low (after P0 fixes)

---

## Next Steps

1. **Design Revision** (4-6 hours)
   - Address all P0 code integration issues
   - Implement mergeDayMetadata utility
   - Define validation state caching
   - Create complete CSS file

2. **Brainstorming Complete** (Phase 3 done)
   - Move to Phase 4: Worktree Setup
   - Then Phase 5: Planning Handoff

3. **Implementation** (after approval)
   - Follow TDD: tests first, then implementation
   - Apply code-reviewer feedback during development
   - Run verification-before-completion before marking done

---

**Review Date:** 2025-10-28
**Next Review:** After P0 issues resolved
**Target M5 Completion:** TBD after revisions
