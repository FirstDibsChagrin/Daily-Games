import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateLeagueForm } from "./create-form";

export const metadata: Metadata = { title: "Create a league" };

export default function CreatePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md px-4 pb-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create a league</CardTitle>
            <CardDescription>
              You&apos;ll be the league creator and get a code to share with friends.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateLeagueForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
