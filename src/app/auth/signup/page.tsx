/**
 * Public self-serve signup is disabled pre-launch. Anyone navigating to
 * /auth/signup is bounced to /auth/login. Customers requesting access
 * use the "Request access →" mailto on the homepage / site header /
 * login footer; their accounts are provisioned via the invitation flow
 * at /auth/invite/[token] once the principal sends an invite.
 */
import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/auth/login");
}
