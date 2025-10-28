# Calendar-Based Recording Day Creation - Design Document

**Status:** DESIGN_DRAFT
**Created:** 2025-10-28
**Milestone:** M5.5.4 - Calendar Day Creation UI

---

## Problem Statement

**Current UX Issues:**
1. Single date input is not intuitive for multi-day experiments
2. Requires multiple clicks to create days for consecutive sessions
3. No visual feedback showing which days already have recordings
4. Difficult to plan recording schedules at a glance

**User Need:**
- **Primary:** Create multiple recording days at once (e.g., Days 1-5 of an experiment)
- **Secondary:** Visualize which days already have recordings
- **Tertiary:** Quickly identify gaps in recording schedules

---

## Proposed Solution

### Calendar UI Component

Replace the current date input + button with an **interactive calendar** that supports:
1. **Single-click** to select/deselect individual dates
2. **Click-and-drag** to select date ranges
3. **Visual indicators** for existing recording days
4. **Bulk creation** via "Create Selected Days" button

### User Workflow

```
1. User navigates to AnimalWorkspace, selects animal
2. Calendar displays with:
   - Current month
   - Existing recording days highlighted (green)
   - Today highlighted (blue border)
3. User clicks first date → selected (blue fill)
4. User drags to last date → range selected (all blue)
5. User clicks "Create N Days" button
6. Days created, calendar updates to show new recordings (green)
```

---

## UI Design

### Calendar Component Structure

```
┌─────────────────────────────────────────────┐
│  Recording Days Calendar                    │
│  ◀ October 2025 ▶                          │
├─────────────────────────────────────────────┤
│  Su  Mo  Tu  We  Th  Fr  Sa                │
│          1   2   3   4   5                 │
│   6   7   8   9  10  11  12                │
│  13  14  15  16  17  18  19                │
│  20  21  22  23  24  25  26                │
│  27  28  29  30  31                        │
│                                             │
│  Legend:                                    │
│  ● Existing recording   ● Selected         │
│  ○ Today               ○ Available         │
├─────────────────────────────────────────────┤
│  [Clear Selection]  [Create 5 Days]  [✕]   │
└─────────────────────────────────────────────┘
```

### Visual States

| State | Appearance | Description |
|-------|-----------|-------------|
| **Available** | White background, gray text | Day can be selected |
| **Selected** | Blue background (#2196f3), white text | User selected for creation |
| **Existing** | Green background (#4caf50), white text, checkmark | Recording day exists |
| **Today** | Blue border, white background | Current date indicator |
| **Disabled** | Gray background, lighter text | Cannot select (existing day) |

### Interaction Patterns

**Selection:**
- **Click**: Toggle single date
- **Click + Drag**: Select range from first to last
- **Ctrl/Cmd + Click**: Add/remove individual dates from selection
- **Clear Selection**: Deselect all

**Creation:**
- Button shows count: "Create 3 Days" (dynamic)
- Disabled when selection is empty or contains existing days
- On click: Creates days, shows success message, clears selection

**Navigation:**
- Month arrows: Previous/Next month
- Today button: Jump to current month
- Keyboard: Arrow keys to navigate, Space to select

---

## Technical Implementation

### Component Architecture

```
CalendarDayCreator/
├── CalendarDayCreator.jsx       # Container (state management)
├── CalendarGrid.jsx             # Calendar rendering
├── CalendarHeader.jsx           # Month navigation
├── CalendarDay.jsx              # Individual day cell
├── CalendarLegend.jsx           # Visual legend
├── CalendarDayCreator.css       # Styling
└── __tests__/
    ├── CalendarDayCreator.test.jsx
    ├── CalendarGrid.test.jsx
    └── selection.test.js        # Selection logic tests
```

### State Management

```javascript
// CalendarDayCreator state
{
  selectedDates: Set(['2025-10-28', '2025-10-29']), // User selection
  currentMonth: { year: 2025, month: 10 },          // Displayed month
  dragStart: '2025-10-28',                          // Drag start date
  isDragging: false,                                // Drag state
}

// Props from AnimalWorkspace
{
  animalId: 'remy',
  existingDays: ['2025-10-15', '2025-10-20'],      // From store
  onCreateDays: (dates) => void,                    // Callback
  onClose: () => void,                              // Close calendar
}
```

### Date Selection Logic

```javascript
/**
 * Handle date selection with multiple modes
 */
function handleDateSelect(date, event) {
  const isExisting = existingDays.includes(date);
  if (isExisting) return; // Cannot select existing days

  if (event.shiftKey && selectedDates.size > 0) {
    // Range selection: select all dates between first and clicked
    const sortedDates = Array.from(selectedDates).sort();
    const start = sortedDates[0];
    const range = getDateRange(start, date);
    setSelectedDates(new Set(range));
  } else if (event.ctrlKey || event.metaKey) {
    // Toggle individual date
    const newSelection = new Set(selectedDates);
    if (newSelection.has(date)) {
      newSelection.delete(date);
    } else {
      newSelection.add(date);
    }
    setSelectedDates(newSelection);
  } else {
    // Single selection (replace)
    setSelectedDates(new Set([date]));
  }
}

/**
 * Handle drag selection
 */
function handleDragSelect(startDate, endDate) {
  const range = getDateRange(startDate, endDate);
  const validDates = range.filter(d => !existingDays.includes(d));
  setSelectedDates(new Set(validDates));
}
```

### Bulk Day Creation

```javascript
/**
 * Create multiple recording days
 */
async function handleCreateDays() {
  const dates = Array.from(selectedDates).sort();

  for (const date of dates) {
    const sessionId = `${animalId}_${date.replace(/-/g, '')}`;

    try {
      actions.createDay(animalId, date, {
        session_id: sessionId,
        session_description: `Recording session for ${animalId} on ${date}`,
      });
    } catch (error) {
      console.error(`Failed to create day ${date}:`, error);
      alert(`Failed to create day ${date}: ${error.message}`);
      return; // Stop on first error
    }
  }

  // Success: clear selection and close calendar
  setSelectedDates(new Set());
  onClose();
}
```

---

## Accessibility (WCAG 2.1 Level AA)

### Keyboard Navigation
- **Tab**: Move focus into/out of calendar
- **Arrow keys**: Navigate between dates
- **Space/Enter**: Select/deselect focused date
- **Ctrl+Arrow**: Navigate without selecting
- **Escape**: Clear selection or close calendar

### Screen Readers
- Calendar grid: `role="grid"`, `aria-label="Recording days calendar"`
- Days: `role="gridcell"`, `aria-selected`, `aria-disabled`
- Create button: `aria-label="Create 3 recording days"`
- Status announcements: `aria-live="polite"` for selection changes

### Focus Management
- Visible focus indicator on current date
- Focus trap when calendar is modal
- Return focus to trigger button on close

---

## Data Flow

```
AnimalWorkspace
  └─> CalendarDayCreator (modal/inline)
      ├─> Read: workspace.days (existing days for animal)
      ├─> User: Select dates via calendar
      ├─> Action: onCreateDays(selectedDates)
      └─> Store: actions.createDay(animalId, date, session) for each date
          └─> Updates: workspace.days, animal.days[]
```

---

## Edge Cases

1. **Creating existing day**: Disabled in UI, skip if attempted
2. **Invalid date selection**: Clear invalid dates from selection
3. **Network/state error**: Show error, keep selection, allow retry
4. **Partial success**: If day 3 of 5 fails, show error with failed date
5. **Empty selection**: Disable create button
6. **Very large ranges**: Confirm if >30 days selected
7. **Past dates**: Allow (retrospective data entry is valid)
8. **Future dates**: Allow (pre-planning experiments)

---

## Migration Strategy

### Phase 1: Add Calendar (Keep Old UI)
- Add calendar component below existing date input
- Both UIs functional during testing
- Feature flag: `enableCalendarDayCreation`

### Phase 2: Replace Old UI
- Remove date input + button
- Make calendar the primary interface
- Update tests

### Phase 3: Cleanup
- Remove feature flag
- Archive old code
- Update documentation

---

## Testing Strategy

### Unit Tests (Component-level)
1. **CalendarGrid**: Renders correct days for month
2. **CalendarDay**: Shows correct visual states
3. **Selection logic**: Single, range, multi-select work correctly
4. **Drag selection**: Correctly selects date ranges
5. **Existing day filtering**: Cannot select existing days

### Integration Tests
1. **Create single day**: Select one date, create succeeds
2. **Create multiple days**: Select range, all days created
3. **Mixed selection**: Skip existing days in selection
4. **Error handling**: Shows error, preserves selection
5. **Calendar navigation**: Month changes, dates update

### Accessibility Tests
1. **Keyboard navigation**: All features accessible via keyboard
2. **Screen reader**: Announces selection changes
3. **Focus management**: Focus visible and logical

---

## Performance Considerations

1. **Render optimization**: Memoize calendar days, only re-render changed cells
2. **Large selections**: Debounce drag selection updates
3. **Date calculations**: Cache month day calculations
4. **Store updates**: Batch day creations into single store update if possible

---

## Future Enhancements

1. **Multi-month view**: Show 3 months at once for long experiments
2. **Recurring patterns**: "Create Mon/Wed/Fri for 4 weeks"
3. **Import from file**: Upload CSV of recording dates
4. **Copy from animal**: "Copy all days from remy to bean"
5. **Quick templates**: "5-day habituation", "2-week baseline"

---

## Open Questions

1. **Modal vs. inline**: Should calendar be a modal dialog or inline in the page?
   - **Recommendation**: Inline first (simpler), modal if space constrained
2. **Default month**: Show current month or month of last recording?
   - **Recommendation**: Current month (more predictable)
3. **Batch size limit**: Warn if selecting >X days?
   - **Recommendation**: Confirm if >30 days (likely error)
4. **Undo support**: Allow undo of bulk creation?
   - **Recommendation**: Defer to M9 (general undo feature)

---

## Success Metrics

1. **Task completion time**: Creating 5 days should take <10 seconds (vs ~30s currently)
2. **Error reduction**: Fewer duplicate day creation attempts
3. **User satisfaction**: Qualitative feedback from lab members
4. **Adoption**: % of sessions using calendar vs. manual creation

---

## Estimated Effort

- **Design review**: 1 hour
- **Calendar component**: 4 hours
- **Selection logic**: 2 hours
- **Integration**: 2 hours
- **Tests**: 3 hours
- **Documentation**: 1 hour
- **Total**: ~13 hours

---

## Dependencies

- React (existing)
- CSS Grid for calendar layout
- No external calendar libraries (build custom for control + accessibility)

---

## Reviewers

- [ ] User (workflow validation)
- [ ] UX reviewer (accessibility, usability)
- [ ] Code reviewer (implementation quality)

---

## Approval Status

- [ ] Design approved
- [ ] Implementation approved
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Ready to merge
