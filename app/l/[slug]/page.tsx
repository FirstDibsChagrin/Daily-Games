import { redirect } from "next/navigation";

export default async function LeagueIndex({ params }: PageProps<"/l/[slug]">) {
  redirect(`/l/${(await params).slug}/today`);
}
