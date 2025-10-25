# Testing Patterns for rec_to_nwb_yaml_creator

> **Machine-readable testing guide for Claude Code**
>
> This document provides explicit decision trees and patterns for writing tests
> in this codebase. Follow the steps sequentially - do NOT skip to reference sections.

**When to read this file:**

- Before writing any test that interacts with form elements
- When encountering "Unable to find element" errors
- When element values are empty after user interactions
- When tests are flaky due to timing issues

**Quick Navigation:**

- [STEP 1: Identify Component Type](#step-1-identify-component-type)
- [STEP 2: Select Query Strategy](#step-2-select-query-strategy)
- [STEP 3: Handle React Timing](#step-3-handle-react-timing)
- [STEP 4: Special Cases](#step-4-special-cases)
- [REFERENCE: Component Catalog](#reference-component-catalog)
- [REFERENCE: Common Patterns](#reference-common-patterns)

---

## STEP 1: Identify Component Type

**Goal:** Determine which custom component renders the field you're trying to interact with.

**Why this matters:** Each component has different DOM structure and query requirements.

### Quick Identification Table

Use the field's **label text** or **placeholder** to identify component type:

| Field Pattern | Component Type | File Location |
|--------------|----------------|---------------|
| "Experimenter Name", "Keywords", "Task Epochs" | **ListElement** | [src/element/ListElement.jsx](../src/element/ListElement.jsx) |
| "Description" (behavioral_events) | **SelectInputPairElement** | [src/element/SelectInputPairElement.jsx](../src/element/SelectInputPairElement.jsx) |
| "Institution", "Genotype", "Species" (with dropdown) | **DataListElement** | [src/element/DataListElement.jsx](../src/element/DataListElement.jsx) |
| "Lab", "Session ID", "Subject ID" | **InputElement** | [src/element/InputElement.jsx](../src/element/InputElement.jsx) |
| "Sex", "Device Type" | **SelectElement** | [src/element/SelectElement.jsx](../src/element/SelectElement.jsx) |
| Multiple checkboxes | **CheckboxList** | [src/element/CheckboxList.jsx](../src/element/CheckboxList.jsx) |
| Multiple radio buttons | **RadioList** | [src/element/RadioList.jsx](../src/element/RadioList.jsx) |

### Decision Tree

```
START: Need to interact with field
  ↓
  Does field have "+ Add" button and show list of items?
    YES → ListElement
    NO → Continue
  ↓
  Does field have "Type:" dropdown + "Index:" number input?
    YES → SelectInputPairElement
    NO → Continue
  ↓
  Does field have autocomplete dropdown?
    YES → DataListElement
    NO → Continue
  ↓
  Is it a standard <input> or <select>?
    YES → InputElement or SelectElement
    NO → CheckboxList or RadioList
```

**Action:** Once identified, proceed to STEP 2.

---

## STEP 2: Select Query Strategy

**Goal:** Choose the correct Testing Library query method based on component type.

**Critical Rule:** NEVER guess the query method. Use this decision matrix.

### Query Strategy Matrix

| Component Type | Query Method | Example | Why This Method? |
|----------------|--------------|---------|-----------------|
| **ListElement** | `getByPlaceholderText()` | `screen.getByPlaceholderText(/Type Task Epochs/i)` | Input lacks `id` attribute ([line 85-92](../src/element/ListElement.jsx#L85-L92)). Label has `htmlFor={id}` but input doesn't match. |
| **SelectInputPairElement** | `getElementById()` for select<br>`getByPlaceholderText()` for input | `document.getElementById('behavioral_events-description-0-list')`<br>`screen.getByPlaceholderText(/DIO info/i)` | Two separate elements: select has predictable ID, input needs placeholder query. |
| **DataListElement** | `getByLabelText()` or `getByPlaceholderText()` | `screen.getByLabelText(/institution/i)`<br>`screen.getByPlaceholderText(/unique text/i)` | Standard label/input association works. Use placeholder if label is ambiguous. |
| **InputElement** | `getByLabelText()` | `screen.getByLabelText(/session id/i)` | Standard HTML label/input association. |
| **SelectElement** | `getByLabelText()` | `screen.getByLabelText(/sex/i)` | Standard HTML label/select association. |
| **CheckboxList** | `getByLabelText()` | `screen.getByLabelText(/option name/i)` | Each checkbox has proper label. |
| **RadioList** | `getByLabelText()` | `screen.getByLabelText(/option name/i)` | Each radio has proper label. |

### Handling Ambiguous Labels

**Problem:** Multiple fields with same label text (e.g., "Description" appears in experiment, session, AND subject sections)

**Solution:** Filter by `name` attribute after querying all matches:

```javascript
// WRONG - assumes order
const descriptionInputs = screen.getAllByLabelText(/description/i);
await user.type(descriptionInputs[0], 'value'); // Which one is this?

// CORRECT - filter by name attribute
const descriptionInputs = screen.getAllByLabelText(/description/i);
const subjectDescriptionInput = descriptionInputs.find(input => input.name === 'description');
await user.type(subjectDescriptionInput, 'value');
```

**Common ambiguous fields:**

- `description` → Filter for `name === 'description'` (subject.description)
- `location` → Use placeholder or filter by parent section

### Placeholder Patterns

For ListElement components, placeholder is computed as `"Type ${title}"` ([line 68](../src/element/ListElement.jsx#L68)):

| Field Title | Computed Placeholder | Query Pattern |
|-------------|---------------------|---------------|
| "Task Epochs" | "Type Task Epochs" | `/Type Task Epochs/i` |
| "Keywords" | "Type Keywords" | `/Type Keywords/i` |
| "Camera ID" | "Type Camera ID" | `/Type Camera ID/i` |

**Action:** After selecting correct query, proceed to STEP 3 for timing considerations.

---

## STEP 3: Handle React Timing

**Goal:** Prevent stale element references caused by React re-renders.

**Critical Rule:** After typing into ANY field, apply blur + delay pattern BEFORE querying the next field.

### The Stale Reference Problem

**What happens:**

1. You query an element: `const nameInput = screen.getByLabelText(/name/i)`
2. You type into it: `await user.type(nameInput, 'value')`
3. Typing triggers `onBlur` → React state update → React re-renders
4. React creates NEW DOM nodes (reconciliation takes ~45-90ms)
5. Your `nameInput` reference now points to a DETACHED node (stale)
6. Next interaction fails or has empty values

**Evidence from debugging:**

```javascript
// Before typing
const dobInput = screen.getByLabelText(/date of birth/i);
await user.type(dobInput, '2024-01-01');

// After typing - element reference is now stale!
console.log(dobInput === screen.getByLabelText(/date of birth/i)); // false
```

### The Solution: Blur + Delay Pattern

**ALWAYS use this pattern after typing into a field:**

```javascript
// 1. Query element
const taskNameInputs = screen.getAllByLabelText(/task name/i);

// 2. Type value
await user.type(taskNameInputs[0], 'sleep');

// 3. Manually trigger blur (forces React to re-render NOW)
taskNameInputs[0].blur();

// 4. Wait for React reconciliation to complete
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

// 5. NOW safe to query next element - React has finished re-rendering
let taskDescInputs = screen.getAllByLabelText(/task description/i);
await user.type(taskDescInputs[0], 'Rest session');
```

### When to Apply This Pattern

| Scenario | Apply Pattern? | Reason |
|----------|---------------|---------|
| After typing into ANY input | **YES** | Typing triggers onBlur → state update |
| After selecting from dropdown | **YES** | Select triggers onChange → state update |
| After clicking add/remove buttons | **YES** | Button triggers state update |
| After clicking checkbox/radio | **YES** | Click triggers state update |
| Before reading element.value | **YES** | Ensure you're reading current DOM |
| Between independent test assertions | **NO** | No state change between assertions |

### Why 100ms?

React reconciliation typically completes in 45-90ms. We use 100ms for safety margin.

```javascript
// From debugging session evidence:
// React Fiber reconciliation: ~45-90ms
// Safety margin: +10-55ms
// Total: 100ms (proven stable across all 11 tests)
```

### Common Mistake - Forgetting to Re-query

```javascript
// WRONG - reusing stale reference
const nameInput = screen.getByLabelText(/name/i);
await user.type(nameInput, 'value');
nameInput.blur();
await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
// Still using old reference - THIS IS STALE!
await user.type(nameInput, 'more text'); // FAILS or empty value

// CORRECT - re-query after blur + delay
const nameInput = screen.getByLabelText(/name/i);
await user.type(nameInput, 'value');
nameInput.blur();
await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
// Query fresh element after React re-render
let freshNameInput = screen.getByLabelText(/name/i);
await user.type(freshNameInput, 'more text'); // WORKS
```

**Action:** After applying timing pattern, check if your scenario needs special case handling (STEP 4).

---

## STEP 4: Special Cases

**Goal:** Handle non-standard interactions that require special patterns.

### Special Case 1: SelectInputPairElement (Concatenated Values)

**Component:** `behavioral_events-description` field ([src/element/SelectInputPairElement.jsx](../src/element/SelectInputPairElement.jsx))

**Behavior:** Component concatenates select value + input value on blur ([line 78](../src/element/SelectInputPairElement.jsx#L78))

```javascript
// Component code:
const value = `${selectRef.current.value}${inputRef.current.value}`;
// Example: select="Dout" + input="2" → value="Dout2"
```

**How to interact:**

```javascript
// 1. Select from dropdown (Din, Dout, Accel, Gyro, Mag)
const eventDescSelect = document.getElementById('behavioral_events-description-0-list');
await user.selectOptions(eventDescSelect, 'Dout');

// 2. Apply blur + delay
eventDescSelect.blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

// 3. Query fresh input element and type number
let eventDescInput = screen.getByPlaceholderText(/DIO info/i);
await user.clear(eventDescInput);
await user.type(eventDescInput, '2');

// 4. Apply blur + delay again
eventDescInput.blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

// 5. Expect concatenated value in export
expect(exportedData.behavioral_events[0].description).toBe('Dout2');
```

**Common mistake:** Trying to type full value like "Dout2" into input field. The input is `type="number"` and only accepts digits.

---

### Special Case 2: ListElement Interactions

**Component:** Fields with "+ Add" button like "Keywords", "Experimenter Name", "Task Epochs"

**Behavior:** Items are added to array by typing + pressing Enter (or clicking + button)

**How to interact:**

```javascript
// 1. Query by placeholder (NOT label)
const taskEpochInput = screen.getByPlaceholderText(/Type Task Epochs/i);

// 2. Type value
await user.type(taskEpochInput, '1');

// 3. Press Enter to add to list (NOT blur!)
await user.keyboard('{Enter}');

// 4. Add more items (input is automatically cleared)
await user.type(taskEpochInput, '3');
await user.keyboard('{Enter}');

// 5. Expect array in export
expect(exportedData.tasks[0].task_epochs).toEqual([1, 3]);
```

**Key difference:** Use `{Enter}` key, not blur pattern. Component handles clearing input.

---

### Special Case 3: Form Export Trigger

**Problem:** jsdom doesn't support `form.requestSubmit()` which is how the real app triggers export

**Solution:** Access React fiber and call onSubmit handler directly

**Pattern:**

```javascript
async function triggerExport(mockEvent = null) {
  // 1. Blur active element to ensure onBlur fires
  if (document.activeElement && document.activeElement !== document.body) {
    await act(async () => {
      fireEvent.blur(document.activeElement);
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  }

  // 2. Get form element
  const form = document.querySelector('form');

  // 3. Access React fiber (internal React structure)
  const fiberKey = Object.keys(form).find(key => key.startsWith('__reactFiber'));
  const fiber = form[fiberKey];

  // 4. Get onSubmit handler from React props
  const onSubmitHandler = fiber?.memoizedProps?.onSubmit;

  if (!onSubmitHandler) {
    throw new Error('Could not find React onSubmit handler on form element');
  }

  // 5. Call handler directly
  const event = mockEvent || {
    preventDefault: vi.fn(),
    target: form,
    currentTarget: form,
  };

  onSubmitHandler(event);
}

// Usage in tests:
await triggerExport();

// Then verify export succeeded:
await waitFor(() => {
  expect(mockBlob).not.toBeNull();
});
```

**Why this works:** React attaches handlers to DOM via fiber tree. jsdom can access this tree even though it can't trigger native events.

---

### Special Case 4: Date Input Format

**Problem:** HTML5 date inputs (`type="date"`) only accept 'YYYY-MM-DD' format, but app stores ISO 8601 timestamps

**Component:** `subject.date_of_birth` field ([src/App.js:1119](../src/App.js#L1119))

**Pattern:**

```javascript
// Query date input
const dobInput = screen.getByLabelText(/date of birth/i);

// Type in YYYY-MM-DD format (NOT ISO 8601!)
await user.type(dobInput, '2024-01-01');

// Expect ISO 8601 in export (onBlur converts it)
expect(exportedData.subject.date_of_birth).toBe('2024-01-01T00:00:00.000Z');
```

**Bug that was fixed:** App.js used to set `defaultValue={formData.subject.date_of_birth}` with full ISO timestamp, which date inputs rejected (showed empty). Now extracts date portion: `defaultValue={formData.subject.date_of_birth.split('T')[0]}`.

---

### Special Case 5: Electrode Group Fields (Wrong Label Pattern)

**Problem:** Common mistake is using generic label patterns that don't match actual field labels

**WRONG patterns:**

```javascript
// These labels DO NOT EXIST in the app
screen.getByLabelText(/targeted x/i)  // WRONG
screen.getByLabelText(/targeted y/i)  // WRONG
screen.getByLabelText(/targeted z/i)  // WRONG
```

**CORRECT patterns:**

```javascript
// Actual labels from App.js
screen.getByLabelText(/ML from Bregma/i)       // For targeted_x
screen.getByLabelText(/AP to Bregma/i)         // For targeted_y
screen.getByLabelText(/DV to Cortical Surface/i) // For targeted_z

// Units field - use placeholder (ambiguous label)
screen.getByPlaceholderText(/Distance units defining positioning/i)
```

**Action:** If none of these special cases apply, proceed to REFERENCE sections for detailed component info.

---

## REFERENCE: Component Catalog

**Purpose:** Deep dive into each component's structure, query strategies, and quirks.

**When to use:** After following Steps 1-4, come here for detailed component information.

---

### InputElement

**File:** [src/element/InputElement.jsx](../src/element/InputElement.jsx)

**Structure:**

```jsx
<label className="container" htmlFor={id}>
  <div className="item1">{title} <InfoIcon /></div>
  <div className="item2">
    <input id={id} name={name} type={type} />
  </div>
</label>
```

**Query Strategy:** `getByLabelText(/title/i)`

**Props:**

- `type`: "text", "number", "date", "email", etc.
- `pattern`: Validation regex (default: `^.+$` - non-empty)
- `required`: Boolean
- `onBlur`: Handler that updates form state

**Special Behavior:**

- Date inputs: Uses `getDefaultDateValue()` helper to format ISO → YYYY-MM-DD ([line 29-44](../src/element/InputElement.jsx#L29-L44))
- Default pattern `^.+$` requires non-whitespace content

**Examples in App:**

- Lab, Institution, Session ID, Subject ID, Genotype, Species, Weight
- All coordinate fields (targeted_x, targeted_y, targeted_z)

---

### DataListElement

**File:** [src/element/DataListElement.jsx](../src/element/DataListElement.jsx)

**Structure:**

```jsx
<label className="container" htmlFor={id}>
  <div className="item1">{title} <InfoIcon /></div>
  <div className="item2">
    <input id={id} list={`${id}-list`} />
    <datalist id={`${id}-list`}>
      {dataItems.map(item => <option value={item} />)}
    </datalist>
  </div>
</label>
```

**Query Strategy:**

- `getByLabelText(/title/i)` - when label is unique
- `getByPlaceholderText(/unique text/i)` - when label is ambiguous

**Props:**

- `dataItems`: Array of autocomplete suggestions
- `placeholder`: Unique text for disambiguation
- `onBlur`: Handler that updates form state

**Special Behavior:**

- Users can type custom values OR select from dropdown
- Autocomplete suggestions appear as user types

**Examples in App:**

- Institution (has autocomplete suggestions)
- Genotype (has autocomplete suggestions)
- Location fields (brain region autocomplete)

---

### ListElement

**File:** [src/element/ListElement.jsx](../src/element/ListElement.jsx)

**Structure:**

```jsx
<label className="container" htmlFor={id}>
  <div className="item1">{title} <InfoIcon /></div>
  <div className="item2">
    <div className="list-of-items">
      {defaultValue.map(item => <span>{item} <button>×</button></span>)}
      <input
        name={name}
        type={type}
        placeholder={textPlaceHolder}  // "Type {title}"
        ref={valueToAdd}
        onKeyPress={e => addListItemViaEnterKey(e, valueToAdd)}
      />
      <button onClick={addListItem}>+</button>
    </div>
  </div>
</label>
```

**Query Strategy:** `getByPlaceholderText(/Type {title}/i)`

**Critical Detail:** Input element has NO `id` attribute ([line 85-92](../src/element/ListElement.jsx#L85-L92))

- Label has `htmlFor={id}` but input doesn't match
- `getByLabelText()` WILL FAIL
- MUST use placeholder query

**Interaction Pattern:**

```javascript
const input = screen.getByPlaceholderText(/Type Keywords/i);
await user.type(input, 'value');
await user.keyboard('{Enter}');  // Adds to list
```

**Props:**

- `type`: "text" or "number"
- `listPlaceHolder`: Custom placeholder (default: `"Type {title}"`)
- `inputPlaceholder`: Text shown when list is empty

**Special Behavior:**

- Items added via Enter key OR + button click
- Duplicates automatically removed ([line 42](../src/element/ListElement.jsx#L42))
- Input automatically clears after adding item

**Examples in App:**

- experimenter_name (ListElement with placeholder "LastName, FirstName")
- keywords (ListElement with placeholder "Type Keywords")
- task_epochs (ListElement with placeholder "Type Task Epochs")

---

### SelectInputPairElement

**File:** [src/element/SelectInputPairElement.jsx](../src/element/SelectInputPairElement.jsx)

**Structure:**

```jsx
<label className="container" htmlFor={id}>
  <div className="item1">{title} <InfoIcon /></div>
  <div className="item2">
    <div className="select-input-pair">
      <div>
        Type: <select id={`${id}-list`} ref={selectRef} onBlur={onSelectPairInput} />
      </div>
      <div>
        Index: <input id={id} ref={inputRef} type="number" onBlur={onSelectPairInput} />
      </div>
    </div>
  </div>
</label>
```

**Query Strategy:**

- Select: `document.getElementById('{id}-list')`
- Input: `getByPlaceholderText(/unique text/i)`

**Critical Detail:** Value is CONCATENATION of select + input ([line 78](../src/element/SelectInputPairElement.jsx#L78))

```javascript
const value = `${selectRef.current.value}${inputRef.current.value}`;
// Example: "Dout" + "2" = "Dout2"
```

**Interaction Pattern:**

```javascript
// 1. Select from dropdown
const select = document.getElementById('behavioral_events-description-0-list');
await user.selectOptions(select, 'Dout');
select.blur();
await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });

// 2. Type number into input
let input = screen.getByPlaceholderText(/DIO info/i);
await user.type(input, '2');

// 3. Value is concatenated: "Dout2"
```

**Props:**

- `items`: Array of select options (e.g., ["Din", "Dout", "Accel", "Gyro", "Mag"])
- `type`: Input type (usually "number")
- `onBlur`: Fires after EITHER select or input blur

**Special Behavior:**

- Both select and input have same `name` attribute
- `onBlur` fires on EITHER element, concatenates both values
- `splitTextNumber()` helper splits value back into parts for defaultValue

**Examples in App:**

- behavioral_events.description (only usage in app)

---

### SelectElement

**File:** [src/element/SelectElement.jsx](../src/element/SelectElement.jsx)

**Structure:**

```jsx
<label className="container" htmlFor={id}>
  <div className="item1">{title} <InfoIcon /></div>
  <div className="item2">
    <select id={id} name={name}>
      {items.map(item => <option value={item}>{item}</option>)}
    </select>
  </div>
</label>
```

**Query Strategy:** `getByLabelText(/title/i)`

**Props:**

- `items`: Array of option values
- `required`: Boolean
- `onBlur`: Handler that updates form state

**Examples in App:**

- subject.sex (options: M, F, U, O)
- electrode_groups.device_type (options: tetrode_12.5, A1x32-6mm-50-177-H32_21mm, etc.)

---

### CheckboxList

**File:** [src/element/CheckboxList.jsx](../src/element/CheckboxList.jsx)

**Query Strategy:** `getByLabelText(/option text/i)` for each checkbox

**Examples in App:**

- (Less common, check App.js for specific usages)

---

### RadioList

**File:** [src/element/RadioList.jsx](../src/element/RadioList.jsx)

**Query Strategy:** `getByLabelText(/option text/i)` for each radio

**Examples in App:**

- (Less common, check App.js for specific usages)

---

### ArrayItemControl

**File:** [src/element/ArrayItemControl.jsx](../src/element/ArrayItemControl.jsx)

**Purpose:** Duplicate/Remove buttons for array items

**Query Strategy:** `getByTitle(/Add {section}/i)` for add buttons

**Examples:**

- "Add electrode_groups" button
- "Add cameras" button
- "Add tasks" button

---

## REFERENCE: Test Helper Functions

**Location:** [src/__tests__/helpers/integration-test-helpers.js](../src/__tests__/helpers/integration-test-helpers.js)

**Purpose:** Pre-built helper functions that extract common patterns following Testing Library best practices.

**Philosophy:**
- ✅ Extract technical implementation details (blur timing, React fiber)
- ✅ Extract repetitive setup patterns (adding array items)
- ✅ Keep test assertions visible in tests (don't hide intent)
- ✅ Make helpers composable (small, focused functions)

### Available Helper Functions

| Function | Purpose | Usage |
|----------|---------|-------|
| `blurAndWait(element)` | Apply blur + delay for React reconciliation | `await blurAndWait(input)` |
| `typeAndWait(user, element, value)` | Type + blur + delay in one call | `await typeAndWait(user, input, 'text')` |
| `selectAndWait(user, element, value)` | Select option + blur + delay | `await selectAndWait(user, select, 'option')` |
| `getLast(elements)` | Get last element from array | `getLast(screen.getAllByLabelText(/name/i))` |
| `addListItem(user, screen, placeholder, value)` | Add item to ListElement | `await addListItem(user, screen, 'Type Keywords', 'keyword')` |
| `triggerExport(mockEvent)` | Export using React fiber | `await triggerExport()` |
| `addCamera(user, screen, camera)` | Add camera with all fields | `await addCamera(user, screen, {name: '...', ...})` |
| `addTask(user, screen, task)` | Add task with all fields | `await addTask(user, screen, {name: '...', ...})` |
| `addElectrodeGroup(user, screen, group)` | Add electrode group with all fields | `await addElectrodeGroup(user, screen, {...})` |
| `fillRequiredFields(user, screen)` | Fill all HTML5 required fields | `await fillRequiredFields(user, screen)` |

### Import in Tests

```javascript
import {
  blurAndWait,
  typeAndWait,
  addCamera,
  addTask,
  addElectrodeGroup,
  fillRequiredFields,
  triggerExport,
} from '../helpers/integration-test-helpers';
```

### Examples

**Before (manual pattern):**
```javascript
taskNameInputs = screen.getAllByLabelText(/task name/i);
await user.type(taskNameInputs[0], 'sleep');
taskNameInputs[0].blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});
```

**After (using helper):**
```javascript
taskNameInputs = screen.getAllByLabelText(/task name/i);
await typeAndWait(user, taskNameInputs[0], 'sleep');
```

**Before (manual camera addition - 42 lines):**
```javascript
const addCameraButton = screen.getByTitle(/Add cameras/i);
let cameraNameInputs = screen.queryAllByLabelText(/camera name/i);
const initialCount = cameraNameInputs.length;
await user.click(addCameraButton);
await waitFor(() => { /* ... */ });
cameraNameInputs = screen.getAllByLabelText(/camera name/i);
await user.type(cameraNameInputs[0], 'overhead_camera');
// ... 35 more lines for all fields
```

**After (using helper - 6 lines):**
```javascript
await addCamera(user, screen, {
  name: 'overhead_camera',
  manufacturer: 'Logitech',
  model: 'C920',
  lens: 'Standard',
  metersPerPixel: '0.001'
});
```

---

## REFERENCE: Common Patterns

**Purpose:** Manual patterns if you can't use helpers or need custom behavior.

---

### Pattern: Blur + Delay (React Timing)

**Use when:** After ANY user interaction that triggers state change

```javascript
// Pattern template
element.blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});
```

**Complete example:**

```javascript
const nameInput = screen.getByLabelText(/name/i);
await user.type(nameInput, 'test value');

// Apply pattern
nameInput.blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

// NOW safe to query next element
let nextInput = screen.getByLabelText(/next field/i);
```

---

### Pattern: Fill Required Fields Helper

**Use when:** Setting up test that needs minimal valid form

```javascript
async function fillRequiredFields(user, screen) {
  // 1. Experimenter name (ListElement)
  const experimenterInput = screen.getByPlaceholderText(/LastName, FirstName/i);
  await user.type(experimenterInput, 'Test, User');
  await user.keyboard('{Enter}');

  // 2. Lab
  const labInput = screen.getByLabelText(/^lab$/i);
  await user.clear(labInput);
  await user.type(labInput, 'Test Lab');

  // 3. Institution
  const institutionInput = screen.getByLabelText(/institution/i);
  await user.clear(institutionInput);
  await user.type(institutionInput, 'Test Institution');

  // 4. Experiment description
  const experimentDescInput = screen.getByLabelText(/experiment description/i);
  await user.type(experimentDescInput, 'Test experiment');

  // 5. Session description
  const sessionDescInput = screen.getByLabelText(/session description/i);
  await user.type(sessionDescInput, 'Test session');

  // 6. Session ID
  const sessionIdInput = screen.getByLabelText(/session id/i);
  await user.type(sessionIdInput, 'TEST01');

  // 7. Keywords (ListElement)
  const keywordsInput = screen.getByPlaceholderText(/Type Keywords/i);
  await user.type(keywordsInput, 'test');
  await user.keyboard('{Enter}');

  // 8. Subject ID
  const subjectIdInput = screen.getByLabelText(/subject id/i);
  await user.type(subjectIdInput, 'test_subject');

  // 9. Subject genotype
  const genotypeInput = screen.getByLabelText(/genotype/i);
  await user.clear(genotypeInput);
  await user.type(genotypeInput, 'Wild Type');

  // 10. Subject date_of_birth
  const dobInput = screen.getByLabelText(/date of birth/i);
  await user.type(dobInput, '2024-01-01');

  // 11. Units analog
  const unitsAnalogInput = screen.getByLabelText(/^analog$/i);
  await user.clear(unitsAnalogInput);
  await user.type(unitsAnalogInput, 'volts');

  // 12. Units behavioral_events
  const unitsBehavioralInput = screen.getByLabelText(/behavioral events/i);
  await user.clear(unitsBehavioralInput);
  await user.type(unitsBehavioralInput, 'n/a');

  // 13. Default header file path
  const headerPathInput = screen.getByLabelText(/^default header file path$/i);
  await user.clear(headerPathInput);
  await user.type(headerPathInput, 'header.h');

  // 14. Data acq device (add 1 item)
  const addDataAcqDeviceButton = screen.getByTitle(/Add data_acq_device/i);
  await user.click(addDataAcqDeviceButton);

  await waitFor(() => {
    expect(screen.queryByText(/Item #1/)).toBeInTheDocument();
  });

  // Verify default values are set (from arrayDefaultValues in valueList.js)
  const deviceNameInput = screen.getByPlaceholderText(/typically a number/i);
  expect(deviceNameInput).toHaveValue('SpikeGadgets');
}
```

---

### Pattern: Trigger Export (React Fiber)

**Use when:** Need to export YAML in tests

```javascript
async function triggerExport(mockEvent = null) {
  // Blur the currently focused element to ensure onBlur fires
  if (document.activeElement && document.activeElement !== document.body) {
    await act(async () => {
      fireEvent.blur(document.activeElement);
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  }

  const form = document.querySelector('form');
  const fiberKey = Object.keys(form).find(key => key.startsWith('__reactFiber'));
  const fiber = form[fiberKey];
  const onSubmitHandler = fiber?.memoizedProps?.onSubmit;

  if (!onSubmitHandler) {
    throw new Error('Could not find React onSubmit handler on form element');
  }

  const event = mockEvent || {
    preventDefault: vi.fn(),
    target: form,
    currentTarget: form,
  };

  onSubmitHandler(event);
}

// Usage:
await triggerExport();

await waitFor(() => {
  expect(mockBlob).not.toBeNull();
});

const exportedYaml = mockBlob.content[0];
const exportedData = YAML.parse(exportedYaml);
```

---

### Pattern: Add Array Item

**Use when:** Adding cameras, tasks, electrode groups, behavioral events, etc.

```javascript
// 1. Get add button by title
const addCameraButton = screen.getByTitle(/Add cameras/i);

// 2. Count existing items BEFORE adding
let cameraNameInputs = screen.queryAllByLabelText(/camera name/i);
const initialCount = cameraNameInputs.length;

// 3. Click add button
await user.click(addCameraButton);

// 4. Wait for item to be added
await waitFor(() => {
  cameraNameInputs = screen.queryAllByLabelText(/camera name/i);
  expect(cameraNameInputs.length).toBe(initialCount + 1);
});

// 5. Fill fields for the NEW item (use [initialCount] or [length - 1])
cameraNameInputs = screen.getAllByLabelText(/camera name/i);
await user.type(cameraNameInputs[initialCount], 'overhead_camera');

// Alternative: Use placeholder for disambiguation
let cameraNameInputs = screen.getAllByPlaceholderText(/unique placeholder/i);
await user.type(cameraNameInputs[cameraNameInputs.length - 1], 'value');
```

---

### Pattern: Add ListElement Item

**Use when:** Adding to experimenter_name, keywords, task_epochs, etc.

```javascript
// 1. Query by placeholder (NOT label!)
const keywordsInput = screen.getByPlaceholderText(/Type Keywords/i);

// 2. Type value
await user.type(keywordsInput, 'spatial navigation');

// 3. Press Enter to add to list
await user.keyboard('{Enter}');

// 4. Add more items (input auto-clears)
await user.type(keywordsInput, 'hippocampus');
await user.keyboard('{Enter}');

// 5. Verify in export
expect(exportedData.keywords).toEqual(['spatial navigation', 'hippocampus']);
```

---

### Pattern: Fill Electrode Group

**Use when:** Testing electrode group functionality

```javascript
// Count existing electrode groups
let electrodeGroupIdInputs = screen.queryAllByPlaceholderText(/typically a number/i);
electrodeGroupIdInputs = electrodeGroupIdInputs.filter(input =>
  input.id && input.id.startsWith('electrode_groups-id-')
);
const initialCount = electrodeGroupIdInputs.length;

// Add electrode group
const addButton = screen.getByTitle(/Add electrode_groups/i);
await user.click(addButton);

await waitFor(() => {
  let updatedInputs = screen.queryAllByPlaceholderText(/typically a number/i);
  updatedInputs = updatedInputs.filter(input =>
    input.id && input.id.startsWith('electrode_groups-id-')
  );
  expect(updatedInputs.length).toBe(initialCount + 1);
});

// Fill fields with blur + delay pattern
let locationInputs = screen.queryAllByPlaceholderText(/type to find a location/i);
await user.type(locationInputs[locationInputs.length - 1], 'CA1');
locationInputs[locationInputs.length - 1].blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Device type
let deviceTypeInputs = screen.queryAllByLabelText(/device type/i);
await user.selectOptions(deviceTypeInputs[deviceTypeInputs.length - 1], 'tetrode_12.5');
deviceTypeInputs[deviceTypeInputs.length - 1].blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Description
let descriptionInputs = screen.queryAllByLabelText(/^description$/i);
await user.type(descriptionInputs[descriptionInputs.length - 1], 'Dorsal CA1 tetrode');
descriptionInputs[descriptionInputs.length - 1].blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Coordinates (use CORRECT labels!)
let targetedXInputs = screen.queryAllByLabelText(/ML from Bregma/i);
await user.type(targetedXInputs[targetedXInputs.length - 1], '1.5');
targetedXInputs[targetedXInputs.length - 1].blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

let targetedYInputs = screen.queryAllByLabelText(/AP to Bregma/i);
await user.type(targetedYInputs[targetedYInputs.length - 1], '2.0');
targetedYInputs[targetedYInputs.length - 1].blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

let targetedZInputs = screen.queryAllByLabelText(/DV to Cortical Surface/i);
await user.type(targetedZInputs[targetedZInputs.length - 1], '3.0');
targetedZInputs[targetedZInputs.length - 1].blur();
await act(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Units (use placeholder for disambiguation)
let unitsInputs = screen.queryAllByPlaceholderText(/Distance units defining positioning/i);
await user.type(unitsInputs[unitsInputs.length - 1], 'mm');
```

---

### Pattern: Test Setup Boilerplate

**Use when:** Setting up integration tests

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import YAML from 'yaml';

describe('My Test Suite', () => {
  let mockBlob;
  let mockBlobUrl;

  beforeEach(() => {
    // Mock Blob for export functionality
    mockBlob = null;
    global.Blob = class {
      constructor(content, options) {
        mockBlob = { content, options };
        this.content = content;
        this.options = options;
        this.size = content[0] ? content[0].length : 0;
        this.type = options ? options.type : '';
      }
    };

    // Mock URL.createObjectURL
    mockBlobUrl = 'blob:mock-url';
    const createObjectURLSpy = vi.fn(() => mockBlobUrl);
    global.window.webkitURL = {
      createObjectURL: createObjectURLSpy,
    };
    global.createObjectURLSpy = createObjectURLSpy;

    // Mock window.alert
    global.window.alert = vi.fn();
  });

  it('test case', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Your test code here
  });
});
```

---

### Pattern: Disambiguate Fields by Name

**Use when:** Multiple fields have same label

```javascript
// WRONG - assumes order
const descriptionInputs = screen.getAllByLabelText(/description/i);
await user.type(descriptionInputs[0], 'value'); // Which field is this?

// CORRECT - filter by name attribute
const descriptionInputs = screen.getAllByLabelText(/description/i);
const subjectDescriptionInput = descriptionInputs.find(input => input.name === 'description');
await user.type(subjectDescriptionInput, 'value');

// Also works for other attributes
const targetField = allFields.find(field => field.id === 'specific-id');
const targetField = allFields.find(field => field.placeholder.includes('unique text'));
```

---

## Summary: Decision Flowchart

```
START: Writing a test
  ↓
STEP 1: Identify component type
  ├─ ListElement? → Use placeholder query
  ├─ SelectInputPairElement? → Use getElementById + placeholder
  ├─ Ambiguous label? → Use placeholder or filter by name
  └─ Standard HTML? → Use getByLabelText
  ↓
STEP 2: Interact with element
  ├─ Type value
  ├─ Select option
  └─ Click button
  ↓
STEP 3: Apply blur + delay pattern
  ├─ element.blur()
  └─ await act + 100ms delay
  ↓
STEP 4: Check special cases
  ├─ SelectInputPairElement? → Interact with both parts
  ├─ ListElement? → Use Enter key
  ├─ Date input? → Use YYYY-MM-DD format
  └─ Electrode group? → Use correct label text
  ↓
STEP 5: Verify in export
  ├─ Trigger export (React fiber pattern)
  ├─ Parse YAML
  └─ Assert expected values
  ↓
END: Test complete
```

---

## Debugging Checklist

When a test fails, check these in order:

1. **Element not found?**
   - [ ] Is it a ListElement? (use placeholder, not label)
   - [ ] Is the label ambiguous? (filter by name attribute)
   - [ ] Did you use correct label text? (check App.js source)
   - [ ] Is element rendered conditionally? (add item first, then query)

2. **Element value is empty?**
   - [ ] Did you apply blur + delay after previous interaction?
   - [ ] Did you re-query element after blur + delay?
   - [ ] Is this a SelectInputPairElement? (need both select + input)

3. **Test is flaky?**
   - [ ] Missing blur + delay pattern somewhere?
   - [ ] Using stale element reference?
   - [ ] Missing waitFor for async operations?

4. **Export doesn't work?**
   - [ ] Using triggerExport() helper with React fiber?
   - [ ] Did you blur active element before export?
   - [ ] Are all required fields filled?

5. **Wrong value in export?**
   - [ ] SelectInputPairElement concatenates values (select + input)
   - [ ] ListElement requires Enter key, not just typing
   - [ ] Date inputs convert YYYY-MM-DD → ISO 8601

---

**Last Updated:** 2025-10-25 (Phase 1.5 - Systematic Debugging Session)
**Status:** Complete machine-readable guide for Claude Code
**Source:** Learnings from systematic debugging session (14 failures → 0 failures)
