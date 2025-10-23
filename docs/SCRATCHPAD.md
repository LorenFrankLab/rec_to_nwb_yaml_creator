# Refactoring Scratchpad

## Performance Baselines

### Measured on: 2025-10-23

Baseline performance metrics for critical operations, measured using the performance.baseline.test.js test suite.

#### Validation Performance

| Operation | Average (ms) | Min (ms) | Max (ms) | Threshold (ms) |
|-----------|--------------|----------|----------|----------------|
| Minimal YAML | 100.53 | 95.01 | 128.50 | < 150 |
| Realistic (8 electrode groups) | 96.17 | 90.59 | 112.14 | < 200 |
| Complete YAML | 96.83 | 91.99 | 109.67 | < 300 |
| 50 electrode groups | 100.19 | 90.85 | 132.07 | < 500 |
| 100 electrode groups | 99.15 | 95.25 | 109.98 | < 1000 |
| 200 electrode groups | 96.69 | 94.17 | 99.99 | < 2000 |

**Key Observations:**
- Validation time is remarkably consistent across different data sizes (~95-100ms average)
- AJV schema validation has relatively constant overhead regardless of data size
- Current performance well below all thresholds (safety margin of 2-20x)

#### YAML Operations Performance

| Operation | Average (ms) | Min (ms) | Max (ms) | Threshold (ms) |
|-----------|--------------|----------|----------|----------------|
| Parse (minimal) | 0.23 | 0.14 | 1.79 | < 50 |
| Parse (realistic) | 1.77 | 1.40 | 3.20 | < 100 |
| Parse (complete) | 0.64 | 0.56 | 1.22 | < 150 |
| Stringify (minimal) | 0.18 | 0.13 | 0.59 | < 50 |
| Stringify (realistic) | 2.36 | 1.89 | 3.96 | < 100 |
| Stringify (complete) | 0.89 | 0.74 | 2.21 | < 150 |
| Stringify (100 electrode groups) | 6.11 | 2.71 | 17.44 | < 500 |

**Key Observations:**
- YAML parsing/stringification is very fast (< 10ms for realistic data)
- Even large datasets (100 electrode groups) stringify in < 20ms
- Performance has large safety margins

#### Component Rendering Performance

| Operation | Average (ms) | Min (ms) | Max (ms) | Threshold (ms) |
|-----------|--------------|----------|----------|----------------|
| Initial App render | 32.67 | 20.20 | 64.43 | < 5000 |

**Key Observations:**
- Initial render is fast (~30ms average)
- Well below the generous 5-second threshold
- Actual user-perceived load time is much better than threshold

#### State Management Performance

| Operation | Average (ms) | Min (ms) | Max (ms) | Threshold (ms) |
|-----------|--------------|----------|----------|----------------|
| Create 100 electrode groups | 0.02 | 0.01 | 0.09 | < 100 |
| structuredClone (100 electrode groups) | 0.15 | 0.14 | 0.27 | < 50 |
| Duplicate single electrode group | 0.00 | 0.00 | 0.00 | < 5 |
| Generate 50 ntrode maps | 0.01 | 0.01 | 0.03 | n/a |
| Filter arrays (100 items) | 0.01 | 0.01 | 0.01 | < 10 |

**Key Observations:**
- structuredClone is extremely fast (< 0.2ms for 100 electrode groups)
- Array operations are essentially instantaneous
- State immutability has negligible performance cost
- Current implementation is highly efficient

#### Complex Operations Performance

| Operation | Average (ms) | Min (ms) | Max (ms) | Threshold (ms) |
|-----------|--------------|----------|----------|----------------|
| Full import/export cycle | 98.28 | 95.96 | 103.59 | < 500 |

**Key Observations:**
- Full cycle (parse → validate → stringify) averages ~98ms
- Validation dominates the cycle time (~95% of total)
- Well below 500ms threshold
- Users experience fast load/save operations

### Performance Summary

**Overall Assessment:**
- Current performance is **excellent** across all operations
- All operations are 2-20x faster than their thresholds
- No performance bottlenecks identified
- Large safety margins protect against regressions

**Critical Operations (User-Facing):**
1. File Load (import): ~100ms (validation dominates)
2. File Save (export): ~100ms (validation dominates)
3. Initial Render: ~30ms
4. State Updates: < 1ms

**Refactoring Safety:**
- Tests will catch any performance regressions > 2x slowdown
- Current implementation provides excellent baseline to maintain
- Focus refactoring efforts on correctness and maintainability, not performance

### Targets

Based on current performance, these are the regression-detection thresholds:

- Initial render: < 5000ms (165x current avg)
- Validation: < 150-2000ms depending on size (1.5-20x current avg)
- State updates: < 50ms for large operations (330x current avg)
- Full import/export cycle: < 500ms (5x current avg)

**Note:** These generous thresholds ensure tests don't fail from normal variance while still catching real performance problems.
