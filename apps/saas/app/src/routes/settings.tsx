import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@ship/ui';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <main id="content">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-6">
        <EmptyState
          title="No settings yet"
          description="Account settings arrive with the auth plugin. Nothing here can be saved."
        />
      </div>
    </main>
  );
}
