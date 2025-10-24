# Testing Patterns - rec_to_nwb_yaml_creator

**Purpose**: Document common testing patterns and pitfalls discovered during Phase 1.5 test development.

**Audience**: Future developers, AI assistants (Claude Code, Copilot, etc.), code reviewers

---

## ⚠️ CRITICAL: The "Missing Required Fields" Problem

### The Problem

**AI assistants (including Claude Code) frequently miss HTML5 form validation requirements** when writing integration tests. This leads to tests that:

1. Fill "obvious" required fields (experimenter, lab, institution)
2. Successfully render the form
3. **Silently fail during export** with no visible errors
4. Waste hours debugging why export doesn't work

### Why This Happens

AI models focus on:

- JSON schema validation (what the backend requires)
- Visible UI elements
- Fields explicitly mentioned in test descriptions

AI models often miss:

- HTML5 `required` attributes on inputs
- HTML5 `pattern` validation (e.g., non-whitespace regex)
- Browser-level validation that blocks form submission
- Fields with empty default values that fail pattern validation

### The Solution Pattern

**ALWAYS check `document.querySelectorAll('input:invalid')` after attempting export:**

```javascript
// After calling onSubmit handler
const invalidInputs = document.querySelectorAll('input:invalid');
console.log('🔍 Invalid inputs found:', invalidInputs.length);
if (invalidInputs.length > 0) {
  console.log('❌ Invalid inputs:', Array.from(invalidInputs).map(input => ({
    id: input.id,
    name: input.name,
    validationMessage: input.validationMessage
  })));
}
```

### Common Missing Required Fields in This App

Based on Test 1 systematic debugging, these fields are **required by HTML5 validation** but easy to miss:

1. **`experiment_description`** - Pattern: `^(.|\\s)*\\S(.|\\s)*$` (non-whitespace)
2. **`session_description`** - Pattern: `^(.|\\s)*\\S(.|\\s)*$` (non-whitespace)
3. **`session_id`** - Pattern: `^(.|\\s)*\\S(.|\\s)*$` (non-whitespace)
4. **`subject.genotype`** - Pattern: `^(.|\\s)*\\S(.|\\s)*$` (non-whitespace)
5. **`subject.date_of_birth`** - Must be valid date format
6. **`units.analog`** - Pattern: `^(.|\\s)*\\S(.|\\s)*$` (non-whitespace)
7. **`units.behavioral_events`** - Pattern: `^(.|\\s)*\\S(.|\\s)*$` (non-whitespace)
8. **`default_header_file_path`** - Pattern: `^(.|\\s)*\\S(.|\\s)*$` (non-whitespace)
9. **`data_acq_device`** - Must have at least 1 item (array validation)
10. **`keywords`** - Must have at least 1 item (array validation)

### Checklist for Integration Tests

When writing end-to-end workflow tests that trigger form submission:

- [ ] Read the App.js form definition to find ALL `required` attributes
- [ ] Read the App.js form definition to find ALL `pattern` attributes
- [ ] Check nwb_schema.json for `minItems` requirements on arrays
- [ ] Fill experiment_description, session_description, session_id
- [ ] Fill subject.genotype (not just subject_id!)
- [ ] Fill units.analog and units.behavioral_events
- [ ] Fill default_header_file_path
- [ ] Add at least 1 keyword
- [ ] Add at least 1 data_acq_device
- [ ] Add debug check for invalid inputs before asserting export success

---

## Form Element Query Patterns

### ListElement (experimenter_name, keywords)

**Problem**: Label has `htmlFor={id}` but input lacks matching `id` attribute

**Solution**: Use `screen.getByPlaceholderText()`

```javascript
// Helper function
async function addListItem(user, screen, placeholder, value) {
  const input = screen.getByPlaceholderText(placeholder);
  await user.type(input, value);
  await user.keyboard('{Enter}'); // Add to list
}

// Usage
await addListItem(user, screen, 'LastName, FirstName', 'Doe, John');
await addListItem(user, screen, 'Type Keywords', 'spatial navigation');
```

### DataListElement (institution, data_acq_device fields)

**Solution**: Use `screen.getByPlaceholderText()` or `screen.getByLabelText()`

```javascript
// By placeholder (most reliable for data_acq_device)
const deviceNameInput = screen.getByPlaceholderText(/typically a number/i);
const deviceSystemInput = screen.getByPlaceholderText(/system of device/i);
const deviceAmplifierInput = screen.getByPlaceholderText(/type to find an amplifier/i);
const deviceAdcInput = screen.getByPlaceholderText(/type to find an adc circuit/i);

// By label (works for institution, subject fields)
const institutionInput = screen.getByLabelText(/institution/i);
```

### ArrayUpdateMenu (add buttons for arrays)

**Problem**: Button only has `title` attribute, no accessible name

**Solution**: Use `screen.getByTitle()`

```javascript
const addDataAcqDeviceButton = screen.getByTitle(/Add data_acq_device/i);
await user.click(addDataAcqDeviceButton);

// Wait for item to render
await waitFor(() => {
  expect(screen.queryByText(/Item #1/)).toBeInTheDocument();
});
```

### ArrayDefaultValues Trap

**Problem**: New array items come with default values from `valueList.js`

**Example**: Adding a data_acq_device creates:

```javascript
{
  name: 'SpikeGadgets',
  system: 'SpikeGadgets',
  amplifier: 'Intan',
  adc_circuit: 'Intan'
}
```

**If you type over defaults without clearing first**:

```javascript
await user.type(deviceNameInput, 'SpikeGadgets');
// Result: 'SpikeGadgetsSpikeGadgets' ❌
```

**Solution**: Either clear first OR verify defaults are correct:

```javascript
// Option 1: Clear first
await user.clear(deviceNameInput);
await user.type(deviceNameInput, 'NewValue');

// Option 2: Verify defaults (if they match what you want)
expect(deviceNameInput).toHaveValue('SpikeGadgets'); // ✅
```

---

## React Form Submission in Tests

### The Problem

Browser form submission methods don't trigger React synthetic event handlers in jsdom:

- `user.click(submitButton)` ❌ (button is type="button", not "submit")
- `form.requestSubmit()` ❌ (doesn't trigger React onSubmit)
- `form.dispatchEvent(new Event('submit'))` ❌ (native event, not React)
- `fireEvent.submit(form)` ❌ (doesn't invoke React handlers)

### The Solution: React Fiber Approach

**Access React's internal fiber and call the onSubmit handler directly:**

```javascript
// Get the form element
const form = document.querySelector('form');

// Access React fiber from DOM element
const fiberKey = Object.keys(form).find(key => key.startsWith('__reactFiber'));
const fiber = form[fiberKey];

// Extract onSubmit handler from React props
const onSubmitHandler = fiber?.memoizedProps?.onSubmit;

if (!onSubmitHandler) {
  throw new Error('Could not find React onSubmit handler on form element');
}

// Create mock event object
const mockEvent = {
  preventDefault: vi.fn(),
  target: form,
  currentTarget: form,
};

// Call handler directly
onSubmitHandler(mockEvent);

// Verify export succeeded
await waitFor(() => {
  expect(mockBlob).not.toBeNull();
});
```

**Why this works**: React stores event handlers in the fiber tree, not as DOM event listeners. We bypass the DOM event system and call React's handler directly.

---

## Export/Blob Mocking Pattern

### Setup in beforeEach

```javascript
let mockBlob;
let mockBlobUrl;

beforeEach(() => {
  // Mock Blob constructor
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
  global.createObjectURLSpy = createObjectURLSpy; // For debugging

  // Mock window.alert (for validation errors)
  global.window.alert = vi.fn();
});
```

### Verify Export

```javascript
// After calling onSubmitHandler
await waitFor(() => {
  expect(mockBlob).not.toBeNull();
});

// Parse exported YAML
const exportedYaml = mockBlob.content[0];
const exportedData = YAML.parse(exportedYaml);

// Verify data
expect(exportedData.experimenter_name).toEqual(['Doe, John']);
expect(exportedData.lab).toBe('Test Lab');
// ... etc
```

---

## Date Format Conversion

**Problem**: HTML date inputs get converted to ISO timestamps in exported YAML

**Example**:

```javascript
// User types
await user.type(dobInput, '2024-01-01');

// YAML contains
date_of_birth: '2024-01-01T00:00:00.000Z'
```

**Solution**: Assert the converted format, not the input format

```javascript
// ❌ Wrong
expect(exportedData.subject.date_of_birth).toBe('2024-01-01');

// ✅ Correct
expect(exportedData.subject.date_of_birth).toBe('2024-01-01T00:00:00.000Z');
```

---

## Debugging Workflow

When a test fails to export YAML:

1. **Check for invalid inputs** (most common):

   ```javascript
   const invalidInputs = document.querySelectorAll('input:invalid');
   console.log('Invalid:', invalidInputs.length);
   ```

2. **Check for validation errors**:

   ```javascript
   console.log('Alerts called:', global.window.alert.mock.calls);
   ```

3. **Check if Blob was created**:

   ```javascript
   console.log('mockBlob:', mockBlob ? 'SET' : 'NULL');
   ```

4. **Check if onSubmitHandler was called**:

   ```javascript
   console.log('preventDefault calls:', mockEvent.preventDefault.mock.calls.length);
   ```

5. **Check React fiber exists**:

   ```javascript
   console.log('Fiber found:', !!fiber);
   console.log('onSubmit found:', !!onSubmitHandler);
   ```

---

## Time Estimates

Based on Test 1 development:

- **With this documentation**: 1-2 hours per test
- **Without this documentation**: 4-6 hours per test (debugging missing fields)
- **Total saved**: 3-4 hours per test × 10 remaining tests = 30-40 hours saved

---

## Common Pitfalls Summary

1. ❌ Missing required fields → Add HTML5 validation check
2. ❌ Using wrong query methods → Use placeholder text patterns
3. ❌ Typing over default values → Clear first or verify defaults
4. ❌ Using form.submit() → Use React fiber approach
5. ❌ Asserting input format for dates → Assert converted ISO format
6. ❌ Forgetting to wait for async rendering → Use waitFor() for dynamic content

---

**Last Updated**: 2025-10-24 (Phase 1.5, Task 1.5.2)
**Test Coverage**: Test 1 complete (10 remaining)
**Status**: Living document - update as new patterns discovered
