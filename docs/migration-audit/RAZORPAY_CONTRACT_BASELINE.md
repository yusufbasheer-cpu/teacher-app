# Razorpay Contract Baseline

Date: 2026-08-31

## Browser-Facing Payment Flow

- `src/app/layout.tsx` loads `https://checkout.razorpay.com/v1/checkout.js` in the browser.
- `src/components/payment/payment-modal.tsx` calls local routes to create orders or subscriptions and then verifies payment/subscription results.

## Contract Sensitivities

- Keep request/response shapes stable for:
  - `/api/razorpay/create-order`
  - `/api/razorpay/create-subscription`
  - `/api/razorpay/verify-payment`
  - `/api/razorpay/verify-subscription`
  - `/api/razorpay/cancel-subscription`
- Do not alter webhook reconciliation behavior without explicit regression coverage.
- Preserve signature verification behavior exactly.

## Risk Notes

- Billing code is high risk.
- Razorpay order/subscription state must remain in sync with local DB rows.
- Admin billing endpoints are particularly sensitive because they update live financial state.

