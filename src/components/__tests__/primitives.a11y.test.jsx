import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import StatusPill, { EpochStatusPill } from '../ui/StatusPill';
import UndoToast from '../ui/UndoToast';
import BlastRadiusChip from '../ui/BlastRadiusChip';
import GeneratedValue from '../ui/GeneratedValue';
import AnimalScopeCard from '../AnimalScopeCard';
import ReadinessBar from '../ReadinessBar';

describe('redesign primitives — accessibility (axe)', () => {
  it('StatusPill has no axe violations', async () => {
    const { container } = render(<StatusPill variant="ready" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('EpochStatusPill has no axe violations', async () => {
    const { container } = render(<EpochStatusPill status="needs_video" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('UndoToast announces via a live region with no axe violations', async () => {
    const { container } = render(
      <UndoToast message="Deleted day" onUndo={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('BlastRadiusChip has no axe violations', async () => {
    const { container } = render(<BlastRadiusChip dayCount={5} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('GeneratedValue has no axe violations in both modes', async () => {
    const generated = render(
      <GeneratedValue value="a.h264" derived onOverride={() => {}} onRevert={() => {}} overrideLabel="Rename" />,
    );
    expect(await axe(generated.container)).toHaveNoViolations();
    generated.unmount();

    const manual = render(
      <GeneratedValue value="a.h264" derived={false} onOverride={() => {}} onRevert={() => {}} overrideLabel="Rename" />,
    );
    expect(await axe(manual.container)).toHaveNoViolations();
  });

  it('ReadinessBar live region announces and has no axe violations (quiet + loud)', async () => {
    const quiet = render(<ReadinessBar issues={[]} onFix={() => {}} />);
    expect(quiet.container.querySelector('[role="status"]')).toBeInTheDocument();
    expect(await axe(quiet.container)).toHaveNoViolations();
    quiet.unmount();

    const loud = render(
      <ReadinessBar issues={[{ severity: 'error', message: 'x', actionLabel: 'Fix' }]} onFix={() => {}} />,
    );
    expect(await axe(loud.container)).toHaveNoViolations();
  });

  it('AnimalScopeCard has no axe violations', async () => {
    const { container } = render(
      <AnimalScopeCard
        summary={{ identity: 'A', probes: 'B', config: 'C', team: 'D' }}
        editHref="#/animal/x/electrode-groups"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
