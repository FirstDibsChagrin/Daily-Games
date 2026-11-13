import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Join a league" };

export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const sp = await searchParams;
  const fromLeague = typeof sp.league === "string";
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md px-4 pb-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Join a league</CardTitle>
            <CardDescription>
              {fromLeague
                ? "This device isn't signed in to that league. Enter its join code to join or sign back in."
                : "Enter the 6-character code a friend shared with you."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
