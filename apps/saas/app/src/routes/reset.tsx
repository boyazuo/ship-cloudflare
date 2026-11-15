import { createFileRoute } from '@tanstack/react-router';
import { ResetPage } from '@ship/auth/client';

export const Route = createFileRoute('/reset')({
  component: ResetPage,
});
