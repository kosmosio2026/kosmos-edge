import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-2xl border bg-card px-4 text-sm outline-none ring-0 placeholder:text-muted',
        className,
      )}
      {...props}
    />
  );
}