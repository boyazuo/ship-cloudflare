import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@ship/ui';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <main>
      <h1 className="mb-6 font-serif text-5xl font-medium tracking-tight">Settings</h1>
      <EmptyState
        title="No settings yet"
        description="Account settings arrive with the auth plugin. Nothing here can be saved."
      />
    </main>
  );
}
