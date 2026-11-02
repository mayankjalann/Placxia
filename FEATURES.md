# Placement workflow additions

The app now supports saved jobs and eligibility filters, company applicant search and interview rounds, in-app notifications, college placement analytics and CSV export, and bulk student allowlist imports.

## Production configuration

- Set `FRONTEND_URL` or `CORS_ORIGIN` in the backend deployment to the exact frontend origin. Multiple origins can be comma-separated. Add the production URL and any preview URL that should be allowed.
- The frontend and API use separate Vercel domains. Production auth cookies therefore use `SameSite=None; Secure`; authenticated write requests also check the request origin against the allowlist.
- Keep `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, Cloudinary credentials, and SMTP credentials in Vercel environment settings. Never put them in client-side `VITE_*` variables or commit them.
- After deploying schema/index changes, confirm the MongoDB indexes are built and review Vercel function logs for index or connection warnings.

## Analytics definitions

- **Authorized students** are allowlist entries; **registered students** have completed account creation. Branch rows include both, including branches that have authorized students but no registrations yet.
- **Placement rate** is placed student profiles divided by registered student profiles. A student with multiple offers counts once as placed.
- **Application funnel** shows each application's current stage, so the stage counts add up to all applications rather than representing stage-to-stage conversion events.
- **Accepted offers over time** counts accepted offer records by the month their status was last updated. A student with multiple accepted offers can contribute more than one accepted offer.
- Company activity is limited to jobs targeted at the admin's college and ranked by applicants.

## Production follow-ups

For a larger rollout, add distributed rate limiting for login and registration (Redis or an edge firewall), queued email delivery, scheduled cleanup/backups, and automated end-to-end checks against a staging database. These need deployment services and credentials that are not part of this repository.

## Optional email notifications

In-app notifications work without any extra environment variables. To also send email when a notification is created, configure these variables in the backend deployment (Vercel → Project Settings → Environment Variables) and redeploy:

- `SMTP_HOST`
- `SMTP_PORT` (usually `587` for STARTTLS or `465` for SSL)
- `SMTP_SECURE` (`true` for port 465, otherwise `false`)
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM` (optional; defaults to `SMTP_USER`)

Do not commit SMTP credentials to the repository.
