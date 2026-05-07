import { SiteHeader } from "@/app/site-header";
import { templatesFor, type CandidateRule } from "../templates";
import { ConfirmClient } from "./confirm-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Step 2 of the setup flow. Receives the firm + selected template
// indices from the setup view via URL params, looks up the matching
// CandidateRule rows, and hands them to the client for review/edit/
// activation. Server-side because Next 15 makes searchParams a
// Promise — easier to await once at the page boundary than to wire
// it through useSearchParams in the client tree.
type Search = { firm?: string; ids?: string };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const firmKey = params.firm ?? "broker_dealer";

  // Parse the comma-separated index list. Anything that isn't a finite
  // non-negative integer is dropped silently — a malformed URL just
  // means "no rules selected" rather than a hard error.
  const indices = (params.ids ?? "")
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n >= 0);

  const allTemplates = templatesFor(firmKey);
  const initialRules: CandidateRule[] = indices
    .map((i) => allTemplates[i])
    .filter((r): r is CandidateRule => Boolean(r));

  return (
    <>
      <SiteHeader />
      <ConfirmClient initialRules={initialRules} />
    </>
  );
}
