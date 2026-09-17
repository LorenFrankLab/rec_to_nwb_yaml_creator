import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveDeploymentConfig } from '../config/deployment';
import { PilotBanner } from './PilotBanner';

describe('PilotBanner', () => {
  it('is absent from the production build', () => {
    const { container } = render(
      <PilotBanner deployment={resolveDeploymentConfig({})} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('identifies a pilot build and links back to the current application', () => {
    render(
      <PilotBanner
        deployment={resolveDeploymentConfig({
          VITE_APP_CHANNEL: 'pilot',
          VITE_APP_COMMIT: '0123456789abcdef',
        })}
      />
    );

    expect(screen.getByText('Pilot')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'build 0123456' })).toHaveAttribute(
      'href',
      'https://github.com/LorenFrankLab/rec_to_nwb_yaml_creator/commit/0123456789abcdef'
    );
    expect(screen.getByRole('link', { name: 'Open current app' })).toHaveAttribute(
      'href',
      'https://lorenfranklab.github.io/rec_to_nwb_yaml_creator/'
    );
    expect(screen.getByText(/saved in this browser/i)).toBeInTheDocument();
  });
});
