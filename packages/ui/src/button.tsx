import type { ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-default disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-foreground hover:bg-accent-hover',
        ghost: 'border border-border bg-card text-foreground hover:bg-inset',
        danger: 'border border-danger bg-card text-danger hover:bg-inset',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} type={type} {...props} />;
}
