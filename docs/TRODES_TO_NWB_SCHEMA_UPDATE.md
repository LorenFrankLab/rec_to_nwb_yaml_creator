# Schema Synchronization: Optogenetics Fields for trodes_to_nwb

**Date:** 2025-10-25
**Created by:** Phase 2 Schema Synchronization (Bug Fix)
**Related Issue:** Schema mismatch between web app and Python package

---

## Summary

The web app (`rec_to_nwb_yaml_creator`) has **5 optogenetics-related fields** that need to be added to the `trodes_to_nwb` Python package schema to maintain full synchronization between repositories.

## Current Status

- ✅ **Web App:** Has complete optogenetics support (5 fields)
- ❌ **trodes_to_nwb:** Missing optogenetics fields
- ⚠️ **Impact:** YAML files exported by web app with optogenetics data will fail validation in Python package

## Fields to Add to trodes_to_nwb Schema

The following 5 properties need to be added to `/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/nwb_schema.json`:

### 1. `fs_gui_yamls`

FsGUI protocol configuration files with epoch assignments and optogenetic parameters.

**Schema Definition** (extract from web app):

```json
"fs_gui_yamls": {
  "$id": "#root/fs_gui_yamls",
  "title": "fs_gui_yamls",
  "type": "array",
  "default": [],
  "description": "FsGui protocol configuration files",
  "items": {
    "type": "object",
    "required": ["name", "task_epochs"],
    "properties": {
      "name": {
        "type": "string",
        "description": "Name of FsGui YAML file"
      },
      "task_epochs": {
        "type": "array",
        "description": "Epochs when this protocol was active"
      },
      "opto_power": {
        "type": "number",
        "description": "Optical stimulation power (mW)"
      }
    }
  }
}
```

### 2. `opto_excitation_source`

Light source specifications for optogenetic stimulation.

**Schema Definition:**

```json
"opto_excitation_source": {
  "$id": "#root/opto_excitation_source",
  "title": "opto_excitation_source",
  "type": "array",
  "default": [],
  "description": "Optogenetic excitation light sources",
  "items": {
    "type": "object",
    "required": ["device_name", "excitation_lambda", "peak_power"],
    "properties": {
      "device_name": {
        "type": "string",
        "description": "Name of light source device"
      },
      "excitation_lambda": {
        "type": "number",
        "description": "Excitation wavelength (nm)"
      },
      "peak_power": {
        "type": "number",
        "description": "Peak power output (mW)"
      }
    }
  }
}
```

### 3. `optical_fiber`

Optical fiber implant specifications with stereotaxic coordinates.

**Schema Definition:**

```json
"optical_fiber": {
  "$id": "#root/optical_fiber",
  "title": "optical_fiber",
  "type": "array",
  "default": [],
  "description": "Optical fiber implant details",
  "items": {
    "type": "object",
    "required": ["name", "coordinates", "location"],
    "properties": {
      "name": {
        "type": "string",
        "description": "Fiber identifier"
      },
      "coordinates": {
        "type": "object",
        "properties": {
          "ap": { "type": "number" },
          "ml": { "type": "number" },
          "dv": { "type": "number" }
        }
      },
      "location": {
        "type": "string",
        "description": "Target brain region"
      }
    }
  }
}
```

### 4. `virus_injection`

Viral vector injection details with coordinates and volumes.

**Schema Definition:**

```json
"virus_injection": {
  "$id": "#root/virus_injection",
  "title": "virus_injection",
  "type": "array",
  "default": [],
  "description": "Viral vector injection specifications",
  "items": {
    "type": "object",
    "required": ["virus", "injection_location", "coordinates", "volume"],
    "properties": {
      "virus": {
        "type": "string",
        "description": "Virus name (e.g., AAV5-CaMKIIa-hChR2-EYFP)"
      },
      "injection_location": {
        "type": "string",
        "description": "Target region"
      },
      "coordinates": {
        "type": "object",
        "properties": {
          "ap": { "type": "number" },
          "ml": { "type": "number" },
          "dv": { "type": "number" }
        }
      },
      "volume": {
        "type": "number",
        "description": "Injection volume (µL)"
      }
    }
  }
}
```

### 5. `opto_software` (optogenetic_stimulation_software)

Software used to control optogenetic stimulation.

**Schema Definition:**

```json
"optogenetic_stimulation_software": {
  "$id": "#root/optogenetic_stimulation_software",
  "title": "optogenetic_stimulation_software",
  "type": "string",
  "default": "",
  "description": "Software controlling optogenetic stimulation"
}
```

**Note:** The web app uses `optogenetic_stimulation_software` internally, but may export as `opto_software` in YAML. Check web app implementation for exact field name.

---

## Validation Rules

**Critical:** If ANY optogenetics field is present, ALL optogenetics fields must be validated together:

- If `opto_excitation_source` exists → require `optical_fiber` and `virus_injection`
- If `optical_fiber` exists → require `opto_excitation_source` and `virus_injection`
- If `virus_injection` exists → require `opto_excitation_source` and `optical_fiber`
- `fs_gui_yamls` and `optogenetic_stimulation_software` are optional even when other opto fields are present

This validation is implemented in the web app's `rulesValidation()` function and should be replicated in the Python package.

---

## Implementation Steps for trodes_to_nwb

1. **Add fields to schema** - Copy the 5 JSON schema definitions above into `nwb_schema.json`

2. **Add to Python data models** - Update Python dataclasses/Pydantic models to include these fields

3. **Add validation logic** - Implement cross-field validation (all-or-nothing for opto fields)

4. **Update NWB conversion** - Add logic to convert these YAML fields to NWB format:
   - `OptogeneticStimulusSite` for fiber/virus/source data
   - `OptogeneticSeries` for stimulation protocols

5. **Test with web app** - Generate YAML files from web app with optogenetics data and verify they convert successfully

---

## Testing

**Test YAMLs:** The web app includes test fixtures with optogenetics data:

```bash
/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/__tests__/fixtures/valid/
```

Look for files containing `opto_excitation_source`, `optical_fiber`, or `virus_injection` fields.

**Integration Test:**

```python
# Test that partial optogenetics fails validation
metadata = {
    "opto_excitation_source": [...],  # Has this
    # Missing optical_fiber and virus_injection
}
# Should raise validation error

# Test that complete optogenetics passes
metadata = {
    "opto_excitation_source": [...],
    "optical_fiber": [...],
    "virus_injection": [...]
}
# Should pass validation
```

---

## Spyglass Database Impact

These fields ultimately feed into the Spyglass database. Ensure:

- NWB files include `OptogeneticStimulusSite` and `OptogeneticSeries` containers
- Spyglass can ingest optogenetics metadata without errors
- Coordinate systems match Spyglass expectations (stereotaxic coordinates)

---

## Contact

For questions or clarifications:
- Web app repository: https://github.com/LorenFrankLab/rec_to_nwb_yaml_creator
- This document: `docs/TRODES_TO_NWB_SCHEMA_UPDATE.md`
- Schema location (web app): `src/nwb_schema.json` (lines for opto fields)

---

## Checklist for trodes_to_nwb Maintainer

- [ ] Extract full opto field schemas from web app `src/nwb_schema.json`
- [ ] Add 5 opto fields to trodes_to_nwb `nwb_schema.json`
- [ ] Update Python data models
- [ ] Implement cross-field validation (all-or-nothing rule)
- [ ] Add NWB conversion logic for optogenetics
- [ ] Test with web app-generated YAML files
- [ ] Verify Spyglass ingestion works
- [ ] Update trodes_to_nwb documentation
- [ ] Update schema hash in integration tests

**Expected Time:** 4-6 hours for complete implementation + testing

---

## ✅ UPDATE: Schema Synchronization Complete (2025-10-25)

**Status:** ✅ COMPLETE - All 5 optogenetics fields added to trodes_to_nwb schema

### Changes Made

**File Modified:** `/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/nwb_schema.json`

**Lines Added:** 532 new lines (35,980 → 36,512 lines)

**Fields Added:**
1. ✅ `opto_excitation_source` (lines 35980-36063)
2. ✅ `optical_fiber` (lines 36064-36207) 
3. ✅ `virus_injection` (lines 36208-36373)
4. ✅ `fs_gui_yamls` (lines 36374-36504)
5. ✅ `opto_software` (lines 36505-36511)

### Verification Results

```
✓ JSON syntax is valid!
✓ Schema properties: 21 → 26 (added 5)
✓ Web App properties: 26
✓ trodes properties: 26
✓ ✓ ✓ ALL PROPERTIES SYNCHRONIZED! ✓ ✓ ✓
```

### Schema Comparison

**Before:**
- Web App: 26 properties (including 5 opto fields)
- trodes: 21 properties (missing 5 opto fields)
- ❌ Mismatch: 5 fields

**After:**
- Web App: 26 properties
- trodes: 26 properties
- ✅ **Fully Synchronized!**

### Next Steps for trodes_to_nwb Maintainer

**Remaining Work (NOT done yet):**

1. **Python Data Models** - Add opto field classes/dataclasses
2. **Validation Logic** - Implement all-or-nothing rule for opto fields
3. **NWB Conversion** - Add `OptogeneticStimulusSite` and `OptogeneticSeries` conversion
4. **Testing** - Test with web app-generated YAML files
5. **Spyglass Integration** - Verify database ingestion works
6. **Documentation** - Update Python package docs
7. **Git Commit** - Commit schema changes (NOT done automatically)

**Estimated Time for Remaining Work:** 2-4 hours (Python + validation + testing)

---

## Summary

✅ **Schema synchronization complete** - All fields present in both repositories  
⚠️ **Python implementation needed** - Schema alone is not sufficient  
📝 **Do not commit yet** - Test thoroughly first  

