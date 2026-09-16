import type { NtrodeMap } from '../state/workspaceTypes';

export interface HeaderNtrode { id: number; channels: number }

/** Read a text Trodes configuration/header; never read the binary recording into memory. */
export function parseTrodesHeader(xml: string): HeaderNtrode[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('External entities and document types are not supported.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('This file is not a valid XML configuration.');
  const nodes = [...document.querySelectorAll('SpikeConfiguration > SpikeNTrode')];
  if (nodes.length === 0) throw new Error('No SpikeNTrode entries found under SpikeConfiguration.');
  const ids = new Set<number>();
  return nodes.map((node) => {
    const value = node.getAttribute('id') ?? '';
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`Invalid Trodes ntrode ID: ${value || '(blank)'}.`);
    const id = Number(value);
    if (ids.has(id)) throw new Error(`Duplicate Trodes ntrode ID: ${id}.`);
    ids.add(id);
    const channels = [...node.children].filter((child) => child.tagName === 'SpikeChannel').length;
    if (!channels) throw new Error(`Trodes ntrode ${id} has no SpikeChannel entries.`);
    return { id, channels };
  });
}

/** Converter's header agreement: the same IDs, each with the same channel count. */
export function compareTrodesHeader(header: HeaderNtrode[], maps: NtrodeMap[]): string[] {
  const issues: string[] = [];
  header.forEach((row) => {
    const map = maps.find((candidate) => candidate.ntrode_id === row.id);
    if (!map) issues.push(`Header ntrode ${row.id} is missing from the mapping (${row.channels} channels).`);
    else if (Object.keys(map.map).length !== row.channels) issues.push(`Ntrode ${row.id}: header has ${row.channels} channels; mapping has ${Object.keys(map.map).length}.`);
  });
  maps.forEach((map) => {
    if (!header.some((row) => row.id === map.ntrode_id)) issues.push(`Mapped ntrode ${map.ntrode_id} is absent from the header.`);
  });
  return issues;
}
