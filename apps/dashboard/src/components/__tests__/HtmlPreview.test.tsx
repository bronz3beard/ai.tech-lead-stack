/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import HtmlPreview, { buildPreviewDocument } from '../chat/HtmlPreview';

const VISUAL = '<!DOCTYPE html><figure><svg role="img"></svg></figure>';

describe('buildPreviewDocument', () => {
  it('prepends a CSP that blocks scripts and all network requests', () => {
    const doc = buildPreviewDocument(VISUAL);

    expect(doc).toMatch(/^<!doctype html><meta http-equiv="Content-Security-Policy"/);
    expect(doc).toContain("default-src 'none'");
    expect(doc).not.toContain('script-src');
  });

  it('drops the original doctype so the CSP stays first in the document', () => {
    const doc = buildPreviewDocument(VISUAL);

    expect(doc.match(/<!doctype/gi)).toHaveLength(1);
    expect(doc).toContain('<figure>');
  });
});

describe('HtmlPreview', () => {
  it('shows the source view by default', () => {
    render(
      <HtmlPreview html={VISUAL}>
        <pre>source view</pre>
      </HtmlPreview>
    );

    expect(screen.getByText('source view')).toBeInTheDocument();
    expect(screen.queryByTitle('HTML visual preview')).not.toBeInTheDocument();
  });

  it('renders the preview in an iframe with every sandbox permission withheld', () => {
    render(
      <HtmlPreview html={VISUAL}>
        <pre>source view</pre>
      </HtmlPreview>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    const frame = screen.getByTitle('HTML visual preview');
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'");
    expect(screen.queryByText('source view')).not.toBeInTheDocument();
  });
});
