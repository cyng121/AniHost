export const runtime = "edge";
import { redirect } from "next/navigation";

export const revalidate = 0;

interface BrowsePageProps {
  searchParams?: Promise<Record<string, string>>;
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const sp = searchParams ? await searchParams : {};
  const query = new URLSearchParams(sp).toString();
  redirect(query ? `/?${query}` : "/");
}
