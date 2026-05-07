/**
 * Pricing isn't published pre-launch — access is provisioned via
 * "Request access →" on the homepage. Anyone hitting this URL lands
 * on / instead so we never serve a 404.
 */
import { redirect } from "next/navigation";

export default function PricingPage() {
  redirect("/");
}
