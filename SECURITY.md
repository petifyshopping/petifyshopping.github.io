# Security checklist

## Client configuration

- Keep `.env`, `.env.local`, and all real credentials out of Git.
- Only the Supabase project URL and public anon key may be exposed to the browser through `VITE_` variables.
- Never put a Supabase `service_role` key, database password, or other privileged credential in frontend code or a `VITE_` variable.
- If a credential is found in current code, a deployed bundle, or Git history, rotate it at the provider. Removing it from the latest commit is not sufficient.
- Run a full-history secret scan (for example, Gitleaks) and enable repository secret scanning.

## Supabase

- Verify Row Level Security is enabled for every application table in the deployed project.
- Review table and Storage policies against the numbered SQL migrations. Test access as anon, customer, staff, and admin users.
- Keep admin operations protected by RLS or role-checking RPCs; UI visibility is not authorization.
- Validate submitted data in database constraints or RPCs as well as in the browser.
- Restrict Storage writes to authorized users and enforce the required file types and size limits.
- Use Supabase Auth rate limits, CAPTCHA where appropriate, email confirmation, short-lived one-use password reset links, and exact redirect allowlists.
- Do not collect or return fields that a screen does not need.

## Hosting and operations

- Require HTTPS and verify HSTS, Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, and frame protections on the deployed site.
- Restrict allowed origins to the deployed storefront and required development origins.
- Confirm production source maps and debug output are not publicly exposed.
- Configure monitoring for authentication failures and authorization errors, and verify database backups and recovery.
- Re-test sign-in, password reset, customer order ownership, admin access, uploads, and invoice workflows after security-related changes.

## Before launch

- Review `npm audit` output and remove dependencies that are no longer used.
- Confirm the deployed Supabase schema and hosting settings; repository migrations do not prove that provider-side settings are applied.
- Do not deploy until the manual checks above are complete.
