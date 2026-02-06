import { redirect } from "next/navigation";

export default async function SettingsPage() {
  // Redirect to /globals for backwards compatibility
  redirect("/globals");
}
