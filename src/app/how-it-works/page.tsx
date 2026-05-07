/**
 * Pre-launch the dedicated /how-it-works page is rolled into the
 * homepage scenario card. Anyone hitting this URL (bookmark, search
 * result, stale CTA) lands on / instead so we never serve a 404.
 */
import { redirect } from "next/navigation";

export default function HowItWorksPage() {
  redirect("/");
}
