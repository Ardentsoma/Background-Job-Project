# Environment Variables Setup Guide

Step-by-step instructions for obtaining each value in your `.env` file.

---

## 1. DATABASE_URL (Neon Postgres)

Neon is a serverless Postgres provider. You need a connection string that looks like:

```
postgresql://username:password@ep-xxxxx.region.aws.neon.tech/dbname?sslmode=require
```

### Steps

1. Go to [neon.tech](https://neon.tech) and sign up or log in (GitHub / Google / email all work).
2. Click **"New Project"** on the dashboard.
3. Choose a project name (e.g. `job-queue`), pick a region close to you, and click **Create Project**.
4. Neon immediately shows you a **Connection Details** panel. You will see a connection string starting with `postgresql://`.
5. Make sure the **Connection type** dropdown says **"Direct"** (not "Pooled" — the `pg` driver manages its own pool).
6. Click the **copy icon** next to the connection string.
7. Paste it into your `.env` file as the `DATABASE_URL` value:

```
DATABASE_URL=postgresql://neondb_owner:abc123xyz@ep-cool-forest-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> **Tip:** If you lose the password, go to **Project Settings → Roles** in the Neon dashboard and reset it.

---

## 2. RESEND_API_KEY (Resend)

Resend is an email sending service. You need an API key that starts with `re_`.

### Steps

1. Go to [resend.com](https://resend.com) and sign up or log in.
2. From the left sidebar, click **"API Keys"**.
3. Click **"Create API Key"**.
4. Give it a name (e.g. `job-queue-dev`).
5. For **Permission**, select **"Sending access"** (that's all this project needs).
6. For **Domain**, you can leave it as **"All domains"** or restrict it to your verified domain.
7. Click **"Add"**.
8. Resend shows the key **once**. Copy it immediately.
9. Paste it into your `.env` file:

```
RESEND_API_KEY=re_abc123_your_actual_key_here
```

> **Warning:** If you lose the key, you must create a new one. Resend does not show keys again after creation.

---

## 3. EMAIL_FROM (Verified Sender Domain)

This is the "From" address used when sending emails. Resend requires that the domain is verified.

### Option A: Use Resend's test address (quickest for development)

If you have not verified a domain yet, Resend gives you a free test address:

```
EMAIL_FROM=onboarding@resend.dev
```

This can only send to the email address on your Resend account. Good enough for testing.

### Option B: Verify your own domain (required for production)

1. In the Resend dashboard, go to **"Domains"** in the left sidebar.
2. Click **"Add Domain"**.
3. Enter your domain (e.g. `yourdomain.com`).
4. Resend shows you **DNS records** you need to add (MX, SPF, and DKIM records).
5. Log in to your domain registrar (e.g. Namecheap, Cloudflare, GoDaddy) and add those DNS records.
6. Go back to Resend and click **"Verify"**. DNS changes can take a few minutes to a few hours to propagate.
7. Once verified, you can send from any address on that domain. Set your `.env` value:

```
EMAIL_FROM=tickets@yourdomain.com
```

---

## 4. PORT (Optional)

This controls which port the Express API listens on. It defaults to `3000` if not set.

```
PORT=3000
```

Change it only if port 3000 is already in use on your machine.

---

## Final Result

After completing all steps, your `.env` file should look like this (with your real values):

```env
# Neon Postgres connection string
DATABASE_URL=postgresql://neondb_owner:yourpassword@ep-cool-forest-12345.us-east-2.aws.neon.tech/neondb?sslmode=require

# Resend API key for sending emails
RESEND_API_KEY=re_abc123_your_actual_key_here

# Verified sender address for outbound emails
EMAIL_FROM=onboarding@resend.dev

# Port the Express API listens on (default 3000)
PORT=3000
```

## Verify Everything Works

```bash
# Run migrations (creates tables in your Neon database)
npm run migrate

# Start the API and test the health check
npm run dev:api
# In another terminal:
curl http://localhost:3000/health
# Expected: {"data":{"status":"ok"}}
```
