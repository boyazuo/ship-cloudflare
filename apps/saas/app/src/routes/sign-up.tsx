import { createFileRoute } from '@tanstack/react-router';
import { SignUpPage } from '@ship/auth/client';
import { appConfig } from '../../../app.config';

export const Route = createFileRoute('/sign-up')({
  component: SignUpRoute,
});

function SignUpRoute() {
  return <SignUpPage siteKey={appConfig.turnstile.siteKey} />;
}
