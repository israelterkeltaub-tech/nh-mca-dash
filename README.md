# NH MCA Dash

This is the first version of **NH MCA Dash** focused on fast submission setup and statement parsing for underwriting review.

## What this build does

- Create a submission card from a submission.
- Mark a submission as `mine` when it has an `IT ISO` label.
- Add monthly statements using pasted OCR text or `.txt/.csv` upload.
- Parse each statement and show:
  - extracted/parsed summary (beginning balance, ending balance, credits, debits)
  - OCR vs parsed comparison with mismatch icon
  - one row per transaction (date, description, amount, category)
  - transaction categories:
    - True Revenue
    - Other
    - MCA Funding
    - MCA Payment
    - Expense
    - Personal
    - Unknown
- Filter by category from chips.
- Correct transaction category manually; corrections are stored as learning rules and reused on later parses.

## Launch

Open `index.html` directly in a browser, or run a local static server:

```bash
python -m http.server
```

Then visit `http://localhost:8000`.

## Repository structure

- `index.html`, `styles.css`, `script.js`: current underwriting review UI.
- `backend/`: ready-to-run API scaffolding for Gmail normalization and statement parsing.
- `.env.example`: environment keys for local dev and deployment.
- `.gitignore`: local secrets/build artifacts ignored.

## Run local UI + backend

Backend (from repo root):

```bash
cd backend
npm install
cp ../.env.example .env
npm run dev
```

UI (separate terminal):

```bash
python -m http.server
```

Backend endpoints:

- `POST http://localhost:3001/api/gmail/normalize`
- `POST http://localhost:3001/api/statements/parse`

Quick local check:

```bash
curl -X POST http://localhost:3001/api/gmail/normalize -H "Content-Type: application/json" -d @backend/samples/gmail_submission.json
curl -X POST http://localhost:3001/api/statements/parse -H "Content-Type: application/json" -d @backend/samples/statement_parse.json
```

## Gmail integration now ready to wire

- Current API accepts normalized email payload and returns a submission object with:
  - `merchant`
  - `subject`
  - `from`
  - `labels`
  - `isMine` (from `IT ISO` detection)
  - attached statement payloads to process.
- Open question for next pass: replace manual payload posting with Gmail API inbox watch/webhook.

## AWS deployment

From `backend/`:

```bash
sam build
sam deploy --guided
```

Set these at minimum:

- `AWS_REGION`
- OpenAI key/model:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`

If you want to move to production persistence, set DynamoDB and extend handlers to persist to `DYNAMO_DEALS_TABLE`.

## AWS frontend deployment (public URL)

This project now includes a GitHub Action that deploys the front-end (root `index.html`, `styles.css`, `script.js`) to S3 as a public website.

### Required GitHub Secrets

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (example: `us-east-2`)
- `AWS_FRONTEND_BUCKET` (must be globally unique, e.g. `nh-mca-dash-ui-<your-org>`)

### One-time setup

1. Go to your repo `Settings` → `Secrets and variables` → `Actions`.
2. Add the secrets above.
3. Push to `main` (or use `workflow_dispatch`).

### What happens after first run

- S3 bucket is created if missing.
- Website hosting config is enabled.
- Bucket becomes publicly readable.
- Files are synced to bucket root.
- GitHub Action output prints your URL in format:
  `http://<AWS_FRONTEND_BUCKET>.s3-website-<AWS_REGION>.amazonaws.com`

If you’d rather keep the bucket private and use CloudFront, I can switch the workflow next to issue a CloudFront distribution and HTTPS URL.

## Next underwriting logic pass

- Gmail watch/ingestion pipeline to auto-create submissions in `review`.
- Underwriting analytics:
  - true revenue calculations (bank-internal heuristics)
  - average daily balance
  - negative day count
  - existing MCA burden estimation
  - underwriting decision scoring

## Notes from the current status flow

Deal status values used in this workflow:
- `review`
- `declined`
- `offered`
- `accepted`
- `funded`


