import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { executeX402PaymentPreflight } from "@/lib/executeX402PaymentPreflight";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute(
  "x402-payment-preflight",
  executeX402PaymentPreflight,
  { endpoint: "/api/api-trust-security-preflight" }
);

export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
