/**
 * @fileoverview DIO behavioral-event suggestion lists (split from the legacy `valueList.js`;
 * re-exported by the `valueList` barrel). Direction-aware event-name suggestions and the valid
 * `Din`/`Dout` description types.
 */

/**
 * Behavioral-event name suggestions, by DIO direction.
 *
 * Verified against the 98-file lab corpus, every recorded event splits cleanly by direction:
 *  - `Din` (inputs the animal triggers): `Poke`, `Run_Camera_Ticks`.
 *  - `Dout` (outputs you drive): `Light`, `Pump`.
 *
 * (Underscored `Run_Camera_Ticks` matches the real spelling — 98/98 corpus files.) So a Din channel
 * only suggests inputs and a Dout channel only suggests outputs; suggesting an output on an input
 * channel would imply a physically wrong wiring. An unknown/"Other" direction (or the no-arg legacy
 * call) gets the union. Names absent from the corpus (`Home box camera`, `Sleep`) are not suggested.
 *
 * @param [direction] - The channel's DIO direction; omit for the union.
 * @returns The suggested event names for that direction.
 */
export const behavioralEventsNames = (direction?: string): string[] => {
  const inputs = ['Poke', 'Run_Camera_Ticks'];
  const outputs = ['Light', 'Pump'];
  if (direction === 'Din') return [...inputs];
  if (direction === 'Dout') return [...outputs];
  return [...inputs, ...outputs];
};

/**
 * Valid DIO `description` types for a behavioral event.
 *
 * Only the digital I/O lines are valid: the exported `description` (e.g. `"Din1"`) is
 * looked up against the `.rec` `ECU_digital` stream during conversion
 * (trodes_to_nwb `get_digitalsignal("ECU_digital", …)`), so it must be a real ECU
 * *digital* channel. `Din` are inputs (sensors the animal triggers); `Dout` are outputs
 * (things you drive — lights, pumps, opto). `Accel`/`Gyro`/`Mag` are ANALOG IMU channels,
 * not digital I/O, so they are intentionally excluded — selecting one would emit a
 * `description` that fails the digital-signal lookup downstream.
 *
 * @returns The valid DIO description types.
 */
export const behavioralEventsDescription = () => {
  return [...['Din', 'Dout']];
};
