import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayTab from '../DayTab';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { encodeYaml } from '../../../io/yaml';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

const mockAnimal = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01' },
  experimenters: { experimenter_name: ['John Doe'], lab: 'Test Lab', institution: 'Test Institution' },
};

const baseDay = {
  date: '2023-06-22',
  session: { session_id: 'remy_20230622', session_description: 'Day 45', experiment_description: '' },
};

const mergedDay = { ...baseDay.session, ...mockAnimal.subject, ...mockAnimal.experimenters };

describe('DayTab — data folder field (off-export)', () => {
  it('writes day.dataFolder via onFieldUpdate on blur', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    render(
      <DayTab animal={mockAnimal} day={baseDay} mergedDay={mergedDay} onFieldUpdate={onFieldUpdate} />
    );

    const folder = screen.getByLabelText(/data folder/i);
    await user.type(folder, '/stelmo/remy/20230622/');
    await user.tab();

    expect(onFieldUpdate).toHaveBeenCalledWith('dataFolder', '/stelmo/remy/20230622/');
  });

  it('pre-fills the field from the stored day.dataFolder (a carried-forward day shows the source folder)', () => {
    render(
      <DayTab
        animal={mockAnimal}
        day={{ ...baseDay, dataFolder: '/stelmo/remy/' }}
        mergedDay={mergedDay}
        onFieldUpdate={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/data folder/i)).toHaveValue('/stelmo/remy/');
  });

  // The merge must never read `dataFolder`, so the exported YAML is byte-identical with and without it.
  it('is off-export: the YAML is byte-identical with and without dataFolder', () => {
    const { animal, day } = buildRealisticWorkspace();
    const withoutFolder = encodeYaml(mergeDayMetadata(animal, day));
    const withFolder = encodeYaml(mergeDayMetadata(animal, { ...day, dataFolder: '/stelmo/remy/20230622/' }));
    expect(withFolder).toBe(withoutFolder);
  });
});
