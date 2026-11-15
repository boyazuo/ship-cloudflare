import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'mt-1.5 h-11 w-full rounded-lg border border-border bg-card px-3 text-base text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal',
        className,
      )}
      {...props}
    />
  );
}
