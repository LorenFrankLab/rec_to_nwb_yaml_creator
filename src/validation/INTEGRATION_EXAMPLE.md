# useQuickChecks Integration Example

This document shows how to integrate the `useQuickChecks` hook with form inputs in App.js.

## Basic Integration

```javascript
import { useQuickChecks } from './validation/useQuickChecks';
import { HintDisplay } from './validation/HintDisplay';

function MyComponent() {
  const [formData, setFormData] = useState({ lab: '' });
  const { hint, validate, clear } = useQuickChecks('required');

  return (
    <div>
      <label htmlFor="lab">Lab Name</label>
      <input
        id="lab"
        value={formData.lab}
        onChange={(e) => {
          setFormData({ ...formData, lab: e.target.value });
          validate('lab', e.target.value);  // Debounced validation
        }}
        onFocus={clear}  // Clear hint when user focuses
      />
      <HintDisplay hint={hint} />
    </div>
  );
}
```

## Date Format Validation

```javascript
const { hint, validate, clear } = useQuickChecks('dateFormat');

<input
  type="text"
  placeholder="YYYY-MM-DDTHH:MM:SS"
  onChange={(e) => validate('session_start_time', e.target.value)}
  onFocus={clear}
/>
<HintDisplay hint={hint} />
```

## Enum Validation

```javascript
const { hint, validate, clear } = useQuickChecks('enum', {
  validValues: ['M', 'F', 'U']
});

<input
  onChange={(e) => validate('subject.sex', e.target.value)}
  onFocus={clear}
/>
<HintDisplay hint={hint} />
```

## Number Range Validation

```javascript
const { hint, validate, clear } = useQuickChecks('numberRange', {
  min: 0,
  max: 1000
});

<input
  type="number"
  onChange={(e) => validate('subject.weight', e.target.value)}
  onFocus={clear}
/>
<HintDisplay hint={hint} />
```

## Pattern Validation

```javascript
const { hint, validate, clear } = useQuickChecks('pattern', {
  pattern: /^[A-Z]/,
  patternMessage: 'Must start with uppercase letter'
});

<input
  onChange={(e) => validate('lab', e.target.value)}
  onFocus={clear}
/>
<HintDisplay hint={hint} />
```

## Integration Notes

### 1. One Hook Per Field

Each input that needs instant hints should have its own hook instance:

```javascript
const labHint = useQuickChecks('required');
const dateHint = useQuickChecks('dateFormat');
const sexHint = useQuickChecks('enum', { validValues: ['M', 'F', 'U'] });
```

### 2. Clear on Focus

Always clear hints when user focuses the input to avoid distraction:

```javascript
onFocus={clear}
```

### 3. Debounce Delay

Default is 300ms. Adjust for better UX:

```javascript
const { hint, validate } = useQuickChecks('required', { debounceMs: 400 });
```

### 4. Styling

HintDisplay uses subtle inline styles. Override with className:

```javascript
<HintDisplay hint={hint} className="my-custom-hint-style" />
```

### 5. No ARIA Announcements

Hints are intentionally NOT announced to screen readers (no `role="alert"`).
Full validation errors (onBlur/onSubmit) should use proper ARIA.

## Full Example: Lab Name Field

```javascript
function App() {
  const [formData, setFormData] = useState(defaultYMLValues);
  const labHint = useQuickChecks('required');

  const handleLabChange = (e) => {
    const newValue = e.target.value;
    setFormData({ ...formData, lab: newValue });
    labHint.validate('lab', newValue);  // Triggers debounced validation
  };

  return (
    <div className="form-group">
      <label htmlFor="lab">
        Lab <span className="required">*</span>
      </label>
      <input
        id="lab"
        name="lab"
        value={formData.lab}
        onChange={handleLabChange}
        onFocus={labHint.clear}
        className="form-control"
      />
      <HintDisplay hint={labHint.hint} />
    </div>
  );
}
```

## Next Steps

1. Integrate with existing form inputs in App.js
2. Add CSS for hint styling
3. Test with real user interactions
4. Gather UX feedback on hint timing and messaging
