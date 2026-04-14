'use client';

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'rgba(24, 24, 27, 0.8)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(39, 39, 42, 1)',
          color: '#fefefe',
        },
        classNames: {
          description: '!text-[#fefefe] !opacity-100',
        },
      }}
    />
  );
}
