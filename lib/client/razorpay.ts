/** Loads Razorpay Standard Checkout and opens the payment modal. */

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Idempotent — safe to call on every button click; only injects the
 *  `<script>` tag once and every caller after that awaits the same load. */
function loadCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("not in a browser"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the payment script. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(options: {
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (response: RazorpaySuccessResponse) => void;
  onDismiss: () => void;
  onFailed: (message: string) => void;
}): Promise<void> {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID is not set");

  await loadCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay checkout failed to load");

  const instance = new window.Razorpay({
    key: keyId,
    amount: options.amount,
    currency: options.currency,
    order_id: options.orderId,
    name: options.name,
    description: options.description,
    prefill: options.prefill,
    theme: { color: "#ff2d16" },
    handler: options.onSuccess,
    modal: { ondismiss: options.onDismiss },
  });
  instance.on("payment.failed", (response) => {
    options.onFailed(response.error?.description ?? "Payment failed. Please try again.");
  });
  instance.open();
}
