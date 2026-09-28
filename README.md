# Background Job Queue

## What this is

A background job system that sends ticket confirmation emails. An Express API enqueues jobs and a separate worker process picks them up, sends emails via Resend, and retries failures with exponential backoff.

## Setup from a fresh clone

```bash
# 1. Install dependencies
npm install

# 2. Create your .env from the example
cp .env.example .env
# Then fill in DATABASE_URL, RESEND_API_KEY, and EMAIL_FROM

# 3. Run migrations against your Neon database
npm run migrate

# 4. Start the API (development)
npm run dev:api

# 5. In another terminal, start the worker (development)
npm run dev:worker
```

## Environment variables

| Variable        | Required | Description                                      |
| --------------- | -------- | ------------------------------------------------ |
| `DATABASE_URL`  | Yes      | Neon Postgres connection string                  |
| `RESEND_API_KEY`| Yes      | API key from Resend for sending emails           |
| `EMAIL_FROM`    | Yes      | Verified sender address on your domain           |
| `PORT`          | No       | Port for the Express API (default: 3000)         |

## Running the API and worker

Instructions for running in development and production will go here.

## Design decisions

Explanations of architectural choices will go here.

## Break-it test results

Results from fault injection and edge case testing will go here.
