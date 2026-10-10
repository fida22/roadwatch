"use client";

export const dynamic = 'force-dynamic';

import DeptShell from "@/components/dept/DeptShell";
import ProjectForm from "@/components/dept/ProjectForm";

export default function NewProjectPage() {
  return (
    <DeptShell>
      <h1 className="mb-1 text-xl font-semibold">Add work</h1>
      <p className="mb-5 text-sm text-ink/70">RoadWatch checks the road against every other department&apos;s works before you save.</p>
      <ProjectForm />
    </DeptShell>
  );
}
