import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Join a league" };

export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const sp = await searchParams;
  const fromLeague = typeof sp.league === "string";
  return (
    <AuthShell
      title="Join a league"
      description={
        fromLeague
          ? "This device isn't signed in to that league. Enter its join code to join or sign back in."
          : "Enter the 6-character code a friend shared with you."
      }
    >
      <CodeForm />
    </AuthShell>
  );
}
