import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { CreateLeagueForm } from "./create-form";

export const metadata: Metadata = { title: "Create a league" };

export default function CreatePage() {
  return (
    <AuthShell
      title="Create a league"
      description="You'll run the league and get a code to share with friends."
    >
      <CreateLeagueForm />
    </AuthShell>
  );
}
