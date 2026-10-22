# Supabase confirmation email

The hosted Supabase **Confirm sign up** template is managed in the Supabase
dashboard. The file [confirmation.html](confirmation.html) is its source.

Publish the application route `/auth/confirm` before changing the hosted
template. Then set the confirmation subject to **Confirm your Layah account**
and paste the HTML into Authentication → Emails → Confirm sign up.

The link uses `{{ .TokenHash }}` and `type=email` so the server can verify the
email without the PKCE cookie from the browser where signup began. The
production URL in this template is intentionally `https://www.layah.in`.

## Staging / experimental Supabase projects

`confirmation.html` hardcodes `https://www.layah.in`, which is correct only for production. A staging project must NOT use it:
the link would send the user to production with a staging token. Use [confirmation.staging.html](confirmation.staging.html)
instead, which builds the link from the project's own **Site URL** (`{{ .SiteURL }}`), so set that Site URL (Authentication →
URL Configuration) to the deployment's origin and add the same origin with `/**` to Redirect URLs.
