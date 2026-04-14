'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  chart: string;
}

/**
 * Initializes mermaid with base configuration for the project.
 */
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  // Use a specific system font — NOT 'inherit'. Mermaid measures text width
  // synchronously via canvas/DOM before the page font loads; 'inherit' causes
  // it to fall back to the browser default, producing incorrect node sizes and
  // clipped labels. This stack matches the Tailwind default and is always available.
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  themeVariables: {
    primaryColor: '#6366f1', // Indigo 500
    primaryTextColor: '#f8fafc', // Slate 50
    primaryBorderColor: '#4f46e5', // Indigo 600
    lineColor: '#94a3b8', // Slate 400
    secondaryColor: '#1e293b', // Slate 800
    tertiaryColor: '#334155', // Slate 700
    mainBkg: '#1e293b', // Slate 800
    nodeBorder: '#475569', // Slate 600
  },
  securityLevel: 'loose',
});

export default function MermaidRenderer({ chart }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    /**
     * @desc Sanitizes AI-generated Mermaid chart strings before rendering.
     * Normalizes known v11-incompatible patterns that the model may still produce
     * despite system prompt constraints (e.g. cylinder nodes, complex pipe labels).
     * @param raw - The raw chart string from the markdown code block.
     * @returns A sanitized chart string safe for mermaid.render().
     */
    function sanitizeMermaidChart(raw: string): string {
      // ── Rule 1: Normalise line endings and whitespace ────────────────
      let chart = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // ── Rule 2: Fix unclosed double quotes in labels ──────────────────
      // If a line has an odd number of double quotes, append one before the closing bracket.
      chart = chart.split('\n').map(line => {
        const quoteCount = (line.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          // If a label has an unclosed quote: Node["Label -> Node["Label"]
          return line.replace(/(\["[^"\]]*)(\s*\])/g, '$1"$2')
                     .replace(/(\("[^"\)]*)(\s*\))/g, '$1"$2');
        }
        return line;
      }).join('\n');

      // ── Rule 3: Collapse multi-line quoted labels ────────────────────
      chart = chart.replace(/\["([\s\S]*?)"\]/g, (_match, content: string) => {
        const singleLine = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        return `["${singleLine}"]`;
      });
      chart = chart.replace(/\("([\s\S]*?)"\)/g, (_match, content: string) => {
        const singleLine = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        return `("${singleLine}")`;
      });

      // ── Rule 4: PATH-SENSE AUTO-QUOTING (Statement-aware) ─────────────
      // Automatically quote unquoted labels that look like file paths or contain
      // characters that Mermaid classifies as tokens (., /, @, etc).
      // We only target node definitions preceded by an ID to avoid inner "A[Label ("path")]" errors.
      chart = chart.replace(/(^|\s|-->|--|-.->|==>)([a-zA-Z0-9_-]+)([\[\(])(?!")([^"\]\)\n]*?[.\/@][^"\]\)\n]*?)([\]\)])/g, 
        (match, prefix, id, open, label, close) => {
          const cleanLabel = label.trim().replace(/"/g, "'");
          return `${prefix}${id}${open}"${cleanLabel}"${close}`;
        }
      );

      // ── Rule 5: Convert cylinder shorthand Node[(Label)] → Node["Label"] ─
      chart = chart.replace(
        /(\w+)\[\((.*?)\)\]/g,
        (_match, id, label) => `${id}["${label.replace(/"/g, "'")}"]`
      );

      // ── Rule 6: Strip trailing dangling edge arrows ─────────────────
      chart = chart.replace(/-->[ \t]*$/gm, '');

      // ── Rule 7: Statement Separation (Fixing "Expecting SQE" errors) ──
      // If multiple node definitions appear on one line without a connection,
      // force a newline to satisfy the Mermaid parser.
      chart = chart.replace(/([\]\)])[ \t]{2,}([a-zA-Z0-9_-]+[\[\(])/g, '$1\n$2');

      // ── Rule 8: Final cleanup ────────────────────────────────────────
      return chart
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trim();
    }

    async function renderChart() {
      if (!containerRef.current || !chart) return;

      try {
        // Generate a unique ID for each chart to avoid collisions
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

        const sanitizedChart = sanitizeMermaidChart(chart);

        const { svg: renderedSvg } = await mermaid.render(id, sanitizedChart);

        if (isMounted) {
          setSvg(makeLabelsVisible(renderedSvg));
          setError(null);
        }
      } catch (err) {
        console.error('Mermaid render failure:', err, { rawChart: chart });
        if (isMounted) {
          setError('fail'); // Use a generic state to stop rendering attempts
        }
      }
    }

    /**
     * @desc Post-processes the Mermaid-rendered SVG string to guarantee labels
     * are never clipped, regardless of font-measurement accuracy at render time.
     *
     * Mermaid v11 wraps each node label in a `<g clip-path="url(#…)">` whose
     * clip rect is sized to the measured text width. If the font loaded at
     * measurement time differs from the render font (race condition), the clip
     * rect is too small and the label text is truncated.
     *
     * Strategy:
     *   1. Strip `clip-path` refs from `<g>` elements — these are exclusively
     *      label containers in Mermaid flowcharts; node shapes do not use them.
     *   2. Remove now-orphaned `<clipPath>` definitions to keep the DOM clean.
     *
     * @param svgString - Raw SVG string from mermaid.render()
     * @returns SVG string with label clip-paths removed
     */
    function makeLabelsVisible(svgString: string): string {
      return (
        svgString
          // 1. Remove clip-path attribute from <g> elements only.
          //    Mermaid only applies clip-path to label wrapper <g> nodes,
          //    never to shape primitives (rect, path, circle).
          .replace(/(<g\b[^>]*?)\s+clip-path="url\(#[^)]+\)"([^>]*>)/g, '$1$2')
          // 2. Remove the now-orphaned <clipPath> definitions
          .replace(/<clipPath\b[^>]*>[\s\S]*?<\/clipPath>/g, '')
      );
    }

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return null; // Suppress UI errors per user request
  }

  return (
    // Outer: clips border-radius corners and enables horizontal scroll on overflow
    <div className="mermaid-container w-full rounded-xl border border-white/5 bg-black/20 overflow-x-auto py-4">
      {/* Inner: min-w-max keeps the SVG at its natural minimum width inside the scroll container */}
      <div
        ref={containerRef}
        className="min-w-max mx-auto px-4"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
