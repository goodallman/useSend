import { notFound } from "next/navigation";

import EmailEditorLabPage from "../(dashboard)/dev-settings/editor-lab/page";

export default function LocalEmailEditorLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-sidebar-background px-4 py-8 text-foreground sm:px-8">
      <EmailEditorLabPage />
    </main>
  );
}
