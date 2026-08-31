/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileForm from '../ProfileForm';
import { getModelOptions } from '@/lib/ai/model-routing-schema';

global.fetch = jest.fn() as jest.Mock;

describe('ProfileForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/settings/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            email: 'user@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
            name: 'Jane Doe',
            image: null,
            modelRouting: {
              planner: 'gemini-3.6-flash',
            },
          }),
        });
      }
      if (url.includes('/api/settings/keys-status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            anthropic: true,
            gemini: true,
            openai: false,
            jules: true,
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  });

  it('renders responsibility select options populated via getModelOptions()', async () => {
    render(<ProfileForm />);

    await waitFor(() => {
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
    });

    expect(screen.getByText('Planner Agent Model')).toBeInTheDocument();
    expect(screen.getByText('Implementer Agent Model')).toBeInTheDocument();
    expect(screen.getByText('Auditor Agent Model')).toBeInTheDocument();
    expect(screen.getByText('Adjudicator Agent Model')).toBeInTheDocument();

    const options = getModelOptions();
    expect(options.length).toBeGreaterThan(1);
  });

  it('updates form state and sends PATCH request on save', async () => {
    render(<ProfileForm />);

    await waitFor(() => {
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeInTheDocument();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/profile',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });
});
