/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { signIn } from 'next-auth/react';
import SignInPage from '../page';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

async function submitCredentials() {
  fireEvent.change(screen.getByLabelText('Email Address'), {
    target: { value: 'dev@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  });
}

describe('SignInPage credentials flow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('navigates client-side to the dashboard after a successful sign-in', async () => {
    (signIn as jest.Mock).mockResolvedValue({ ok: true, error: null });
    render(<SignInPage />);

    await submitCredentials();
    act(() => {
      jest.runAllTimers();
    });

    expect(signIn).toHaveBeenCalledWith('credentials', {
      email: 'dev@example.com',
      password: 'secret',
      redirect: false,
    });
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('stays on the sign-in page when credentials are rejected', async () => {
    (signIn as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'CredentialsSignin',
    });
    render(<SignInPage />);

    await submitCredentials();
    act(() => {
      jest.runAllTimers();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
