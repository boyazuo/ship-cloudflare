import { createFileRoute } from '@tanstack/react-router';
import { SignInPage } from '@ship/auth/client';

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
});
