# FixNow

FixNow is a Next.js and TypeScript MVP scaffold for a Sri Lankan, in-house maintenance business. It is not a provider marketplace. Customers make enquiries; FixNow staff follow up, quote, and schedule internal teams.

## Start locally

1. Install Node.js 20 or newer and run `npm install`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` and replace the `AUTH_SECRET` placeholder with at least 32 random bytes. For example, generate a value with `openssl rand -base64 48`; do not commit `.env` or share the secret.
3. For a new empty database, run `npx prisma migrate deploy` and `npx prisma generate`. For an existing database, back it up and follow the migration state instructions below before deploying migrations.
4. Create the first staff account interactively with `node scripts/create-admin.mjs`. The password is hidden while typing, must be at least 14 characters, and is stored as a bcrypt hash. The script will not overwrite an existing administrator. Run it from a private terminal after configuring `.env`.
5. Run `npm run dev` and open `http://localhost:3000/admin/login`.

Admin login: `/admin/login`; the protected dashboard is `/admin`, and the request list is `/admin/requests`. Sign out from the dashboard or request page. Unauthenticated dashboard and API requests are redirected to sign-in or return HTTP 401, respectively.

The sign-in API requires `AUTH_SECRET` to contain at least 32 bytes. Admin identities are stored in the existing `AdminUser` table; there is no public admin registration and customer accounts are never promoted to admin. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are not used by this database-backed design.

## Request notifications

New requests are saved before the email is sent. Email delivery uses Resend from the server. Its result is stored with the request and shown in the admin list. A failed email does not undo the request; administrators can retry failed or pending notifications from the dashboard.

Set these in `.env` (never in browser code):

```dotenv
RESEND_API_KEY="re_..."
FIXNOW_NOTIFICATION_EMAIL="operations@your-company.lk"
FIXNOW_FROM_EMAIL="FixNow <notifications@your-company.lk>"
```

In Resend, add the sending domain you will use, publish the DNS records Resend supplies (including its verification and DKIM records), and wait until the domain is marked verified. Use an address on that verified domain for `FIXNOW_FROM_EMAIL`. Keep the API key server-side. Until these variables and a verified sender are configured, requests are still saved and the dashboard shows the email notification as failed with the reason.

The WhatsApp button in each admin request opens `wa.me` with the customer's Sri Lankan phone number normalized to international format and a prefilled message containing the request reference. The staff member must review and press Send in WhatsApp; FixNow does not send WhatsApp messages automatically. Staff can record the outcome in the contact history.

The migration `202610230001_initial` is the baseline for the existing Prisma models before request notification support; `202610230002_request_notifications` adds the notification table. For a database that already has the pre-existing FixNow tables but no Prisma migration history, take a backup, verify its schema matches the baseline migration, then run `npx prisma migrate resolve --applied 202610230001_initial` followed by `npx prisma migrate deploy`. Do not mark the baseline applied if those tables do not match it. For an existing database that already has migration history, use `npx prisma migrate deploy` after checking the migration state.

## End-to-end check

1. Sign in at `/admin/login`; the admin homepage is `/admin` and requests are at `/admin/requests`.
2. Submit `/request-service`; the form displays the `FN-YYYY-NNNN` reference after the request is committed.
3. Confirm the request appears at the top of `/admin/requests`. Email shows `SENT` only when Resend accepts it. On failure, the request remains saved and staff can retry after fixing configuration.
4. Call the customer or open **WhatsApp**, review the prefilled message, and press Send in WhatsApp. Log the contact outcome.
5. Open the request and create a quotation in LKR. Share the generated customer approval link.
6. Open the approval link as the customer and approve it. Only then does the request become eligible for job creation.
7. Add internal workers at `/admin/workers`. Create a job from `/admin/jobs`, assign worker(s), and schedule it. The server rejects an exact-time double booking for an assigned worker.
8. Update job progress from `/admin/jobs`. Record received payments at `/admin/payments`; the app stores integer cents and prevents recording more than the remaining charge.

There is no test-mode email sender in this project. Verify actual email delivery using a Resend API key and a sender domain marked verified in Resend.

## Implemented in this scaffold

- Responsive public homepage, navigation, footer, and 20 service categories.
- Searchable service directory and reusable service detail routes.
- Request form with server-side validation, SQLite/Prisma persistence, and a sequential request reference inside a database transaction.
- Password-hashed admin account setup, signed HTTP-only admin cookie, login, and protected request listing.
- Initial privacy and terms templates, identified as requiring company/legal review.

## Current MVP scope

The admin dashboard, request follow-up, LKR quotations with token-based customer approval, internal worker assignment, job scheduling/status, and payment recording use live Prisma data. Notification email uses Resend; WhatsApp is a staff-initiated click-to-chat link. Worker records currently contain only an internal name and active flag. Teams, full audit history, detailed schedule calendar views, automated email delivery for quotations, customer login, and payment gateway integration are not included. Payment entries are records entered by authorized staff after verifying the payment outside this app.

No external notification credentials are configured. The contact details, service areas, business hours, and company identity are placeholders and must be replaced with verified details.
