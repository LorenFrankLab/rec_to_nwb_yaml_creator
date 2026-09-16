/** Fully entered implanted setup, including valid zero-degree coordinates. */
export function completeOptogenetics() {
  return {
    opto_excitation_source: [{ name: 'LED-470', model_name: 'M', description: 'Blue light source', wavelength_in_nm: 470, power_in_W: 0.01, intensity_in_W_per_m2: 100 }],
    optical_fiber: [{ name: 'Fiber 1', hardware_name: 'H', implanted_fiber_description: 'CA1 implant', hemisphere: 'left', location: 'CA1', ap_in_mm: 1, ml_in_mm: 1, dv_in_mm: 1, roll_in_deg: 0, pitch_in_deg: 0, yaw_in_deg: 0, reference: 'Bregma' }],
    virus_injection: [{ name: 'Injection 1', description: 'CA1 injection', virus_name: 'AAV', volume_in_uL: 0.5, titer_in_vg_per_ml: 1e12, hemisphere: 'left', location: 'CA1', ap_in_mm: 1, ml_in_mm: 1, dv_in_mm: 1, roll_in_deg: 0, pitch_in_deg: 0, yaw_in_deg: 0, reference: 'Bregma' }],
    optogenetic_stimulation_software: 'fsgui',
  };
}
