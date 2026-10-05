/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { GithubIcon } from '../GithubIcon';

describe('GithubIcon', () => {
  it('renders an svg that takes its size from className, like the lucide icon it replaces', () => {
    const { container } = render(<GithubIcon className="mr-2 h-5 w-5" />);
    const svg = container.querySelector('svg');

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('mr-2', 'h-5', 'w-5');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBeTruthy();
  });

  it('is decorative by default, so screen readers skip it next to its text label', () => {
    const { container } = render(<GithubIcon />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('inherits the text colour so existing text-* classes still apply', () => {
    const { container } = render(<GithubIcon className="text-zinc-600" />);

    expect(container.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  });

  it('can be made meaningful by the caller', () => {
    const { getByRole } = render(
      <GithubIcon role="img" aria-hidden={false} aria-label="GitHub" />
    );

    expect(getByRole('img', { name: 'GitHub' })).toBeInTheDocument();
  });
});
