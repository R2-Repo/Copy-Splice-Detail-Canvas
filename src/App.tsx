import { AppShell } from "@/components/layout/AppShell";
import { WorkflowCanvas } from "@/features/canvas/WorkflowCanvas";

export default function App() {
  return (
    <AppShell title="Splice Detail Canvas">
      <WorkflowCanvas />
    </AppShell>
  );
}
