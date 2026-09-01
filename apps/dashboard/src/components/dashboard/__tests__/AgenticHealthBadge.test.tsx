import React from 'react';
import { render, screen } from '@testing-library/react';
import { AgenticHealthBadge } from '../AgenticHealthAlerts';
import { EvaluatorHealthClassification } from '@/lib/agentic-metrics';
import '@testing-library/jest-dom';

describe('AgenticHealthBadge Component', () => {
  it('renders NODDING_LOOP state correctly', () => {
    const health: EvaluatorHealthClassification = { state: 'NODDING_LOOP', err: 0, sampleSize: 20 };
    render(<AgenticHealthBadge health={health} />);
    const badge = screen.getByText('NODDING LOOP');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('destructive'); // uses 'destructive' variant
  });

  it('renders BLOCKED_EVALUATOR state correctly', () => {
    const health: EvaluatorHealthClassification = { state: 'BLOCKED_EVALUATOR', err: 0.96, sampleSize: 25 };
    render(<AgenticHealthBadge health={health} />);
    const badge = screen.getByText('BLOCKED EVALUATOR');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-amber-500'); // Check custom styling
  });

  it('renders HEALTHY state correctly', () => {
    const health: EvaluatorHealthClassification = { state: 'HEALTHY', err: 0.5, sampleSize: 30 };
    render(<AgenticHealthBadge health={health} />);
    const badge = screen.getByText('HEALTHY');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-emerald-500'); // Check custom styling
  });

  it('renders WATCH state correctly', () => {
    const health: EvaluatorHealthClassification = { state: 'WATCH', err: 0, sampleSize: 5 };
    render(<AgenticHealthBadge health={health} />);
    const badge = screen.getByText('WATCH');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-muted-foreground'); // Check custom styling
  });
});
