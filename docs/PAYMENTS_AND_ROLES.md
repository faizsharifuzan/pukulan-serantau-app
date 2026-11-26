# Payments & Roles

## Roles
| Role | Can do |
|---|---|
| admin | Everything: users/roles, students, parent links, tournaments, fees, products, branches, payments |
| coach | Grade & edit students, weight, attendance, training logs, approve claims, verify bank transfers |
| parent / student | Own children/profile, cart, pay, cancel own pending payments |

Roles can only be changed by an admin (enforced by DB trigger). Coach sign-ups are requests approved by an admin.

## Herepay (FPX) flow
1. App calls Edge Function `create-herepay-link` with cart item ids only.
2. DB function `create_payment_order` recomputes every amount from DB prices.
3. Function creates a single-use Herepay Payment Link; callback URL carries `ref` + secret `t` token.
4. Herepay POSTs to `herepay-callback`; checksum (HMAC-SHA256, Private Key) is verified; DB function `apply_gateway_result` checks amount, token and replay, then marks `paid` exactly once.

## Supabase secrets (Edge Functions)
`HEREPAY_SECRET_KEY`, `HEREPAY_PRIVATE_KEY`, `HEREPAY_BASE_URL` (UAT: `https://uat.herepay.org`, live: `https://app.herepay.org`), `FRONTEND_URL` (https site URL).
