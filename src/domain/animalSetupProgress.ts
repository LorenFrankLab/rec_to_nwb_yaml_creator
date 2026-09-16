import { getAnimalSubject, getAnimalExperimenters, getExperimenterNames, getDataAcqDevices } from '../state/workspaceSelectors';

/** Missing reusable facts stay visible before an animal has a recording to validate. */
export function missingAnimalSetupFacts(animal: unknown): { identity: string[]; team: string[] } {
  const subject = getAnimalSubject(animal);
  const team = getAnimalExperimenters(animal);
  const identity = [
    ['subject ID', subject.subject_id], ['species', subject.species], ['sex', subject.sex],
    ['genotype', subject.genotype], ['date of birth', subject.date_of_birth],
  ].filter(([, value]) => !String(value ?? '').trim()).map(([label]) => label as string);
  const missingTeam = [
    ['experiment description', (animal as { experiment_description?: unknown } | null)?.experiment_description],
    ['lab', team.lab], ['institution', team.institution],
  ].filter(([, value]) => !String(value ?? '').trim()).map(([label]) => label as string);
  if (!getExperimenterNames(animal).some((name) => String(name).trim())) missingTeam.push('experimenters');
  return { identity, team: missingTeam };
}

/** Review applies to this exact catalog; a hardware edit requires another review. */
export function recordingSystemSignature(animal: unknown): string {
  return JSON.stringify(getDataAcqDevices(animal));
}

export function recordingSystemReviewed(animal: unknown): boolean {
  return getDataAcqDevices(animal).length > 0 &&
    (animal as { recordingSystemReviewed?: string } | null)?.recordingSystemReviewed === recordingSystemSignature(animal);
}
