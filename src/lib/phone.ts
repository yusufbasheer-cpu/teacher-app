/** Strip everything but digits so "+91 98765 43210" and "919876543210" compare equal. */
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Phone-only signup has no real email, but Supabase (and Razorpay) still
 * need one on the account. `.invalid` is the IANA-reserved TLD for exactly
 * this purpose (RFC 2606) — guaranteed to never resolve or be deliverable.
 */
const PHONE_ACCOUNT_DOMAIN = "phone.invalid";

export function syntheticEmailForPhone(digits: string): string {
  return `phone-${digits}@${PHONE_ACCOUNT_DOMAIN}`;
}

export function isSyntheticPhoneEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${PHONE_ACCOUNT_DOMAIN}`);
}
