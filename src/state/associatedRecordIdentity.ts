import type { AssociatedFile, AssociatedVideoFile } from './workspaceTypes';

function inferredFileKind(file: Partial<AssociatedFile>): NonNullable<AssociatedFile['kind']> {
  const text = [file.name, file.description, file.path]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return /\bstatescript\b/.test(text) || /statescriptlog/.test(text)
    ? 'statescript'
    : 'supplemental';
}

function uniqueId(
  requested: unknown,
  used: Set<string>,
  prefix: string,
  index: number
): string {
  if (typeof requested === 'string' && requested.trim() && !used.has(requested)) {
    used.add(requested);
    return requested;
  }
  let suffix = index + 1;
  let candidate = `${prefix}-${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${prefix}-${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

/** Preserve existing IDs and deterministically assign IDs/kinds to newly stored file rows. */
export function ensureAssociatedFileIdentity(
  dayId: string,
  files: AssociatedFile[]
): AssociatedFile[] {
  const used = new Set<string>();
  return files.map((file, index) => ({
    ...file,
    recordId: uniqueId(file.recordId, used, `${dayId}-file`, index),
    kind: file.kind === 'statescript' || file.kind === 'supplemental'
      ? file.kind
      : inferredFileKind(file),
  }));
}

/** Preserve existing IDs and deterministically assign IDs to newly stored video rows. */
export function ensureAssociatedVideoIdentity(
  dayId: string,
  videos: AssociatedVideoFile[]
): AssociatedVideoFile[] {
  const used = new Set<string>();
  return videos.map((video, index) => ({
    ...video,
    recordId: uniqueId(video.recordId, used, `${dayId}-video`, index),
  }));
}

/** v4 → v5: add stable internal identity without discarding malformed collections. */
export function migrateAssociatedRecordIdentityV4ToV5(workspace: object): object {
  const next = structuredClone(workspace) as Record<string, unknown>;
  const days = next.days;
  if (!days || typeof days !== 'object' || Array.isArray(days)) return next;
  for (const [dayKey, rawDay] of Object.entries(days as Record<string, unknown>)) {
    if (!rawDay || typeof rawDay !== 'object' || Array.isArray(rawDay)) continue;
    const day = rawDay as Record<string, unknown>;
    const dayId = typeof day.id === 'string' && day.id ? day.id : dayKey;
    const associatedFiles = day['associated_files'];
    if (Array.isArray(associatedFiles)) {
      day['associated_files'] = ensureAssociatedFileIdentity(
        dayId,
        associatedFiles as AssociatedFile[]
      );
    }
    const associatedVideos = day['associated_video_files'];
    if (Array.isArray(associatedVideos)) {
      day['associated_video_files'] = ensureAssociatedVideoIdentity(
        dayId,
        associatedVideos as AssociatedVideoFile[]
      );
    }
  }
  return next;
}
