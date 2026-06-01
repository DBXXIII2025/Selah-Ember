# Giving and Stripe Plan

Selah Ember giving is currently a non-payment foundation. It can collect giving intent records, but it must not collect card, bank, or payment credential data until live payments are formally enabled.

Future live giving should use Stripe Connect so churches receive funds directly through their own connected Stripe accounts. Donations should never be routed through a personal account.

Stripe Connect requirements:
- Each church/community that receives funds needs its own connected Stripe account.
- The platform can later add an optional platform fee if the legal, tax, and product requirements are reviewed.
- Payment records should map Stripe PaymentIntents to Selah Ember giving intents.
- Webhooks must verify Stripe signatures before updating payment status.

Before live payments:
- Complete terms, privacy, tax, and legal review.
- Define refund, dispute, receipt, and donor-support handling.
- Confirm nonprofit/church onboarding requirements.
- Add secure webhook processing and audit logs.
- Keep card and bank collection inside Stripe-hosted or Stripe-controlled components only.
