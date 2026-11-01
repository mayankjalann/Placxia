# Placement workflow additions

The app now supports saved jobs and eligibility filters, company applicant search and interview rounds, in-app notifications, college placement analytics and CSV export, and bulk student allowlist imports.

## Optional email notifications

In-app notifications work without any extra environment variables. To also send email when a notification is created, configure these variables in the backend deployment (Vercel → Project Settings → Environment Variables) and redeploy:

- `SMTP_HOST`
- `SMTP_PORT` (usually `587` for STARTTLS or `465` for SSL)
- `SMTP_SECURE` (`true` for port 465, otherwise `false`)
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM` (optional; defaults to `SMTP_USER`)

Do not commit SMTP credentials to the repository.
