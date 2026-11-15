import { createFileRoute } from '@tanstack/react-router';
import { AccountSettings } from '@ship/auth/client';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <main id="content" className="page">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="page-lede">Name, sessions, and account removal.</p>
      </header>
      <AccountSettings />
    </main>
  );
}
