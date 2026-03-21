# ClarkFin Bootstrap Guide

This guide is the "from zero to running locally" recipe for open-source users. It follows the same path we used while standing up the project for the first time.

## Before you start
- You need a Google account that can create a Firebase project.
- You need Node.js and npm installed locally.
- You should work from a local clone of this repository.

## Recipe 1: Create a Firebase project
1. Open the Firebase Console: `https://console.firebase.google.com/`
2. Create a new project.
3. Choose a project ID you want ClarkFin to use.

Placeholder links:
- Firebase Console home: `https://console.firebase.google.com/`
- Firebase project creation docs: `https://firebase.google.com/docs/projects/learn-more`

Expected result:
- You have a Firebase project such as `<your-project-id>`.

## Recipe 2: Create the Firebase web app and copy the web config
1. In Firebase, open Project settings.
2. Add a Web App to the project.
3. Copy the Firebase web config values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
4. Copy `.env.example` to `.env.local`.
5. Fill in the `NEXT_PUBLIC_FIREBASE_*` values in `.env.local`.

Placeholder links:
- Project settings: `https://console.firebase.google.com/project/<your-project-id>/settings/general`
- Firebase web setup docs: `https://firebase.google.com/docs/web/setup`

Expected result:
- `.env.local` contains the browser-safe Firebase configuration.

## Recipe 3: Enable Firebase Authentication
1. Open Firebase Authentication in the console.
2. Click `Get started` if Authentication is not initialized yet.
3. Enable the `Email/Password` sign-in provider.
4. Confirm `localhost` appears under Authorized domains for local development.

Placeholder links:
- Authentication console: `https://console.firebase.google.com/project/<your-project-id>/authentication`
- Sign-in method docs: `https://firebase.google.com/docs/auth/web/password-auth`

Expected result:
- ClarkFin can create and sign in users with email/password locally.

## Recipe 4: Create the Firebase Admin service account
1. Open Firebase Project settings.
2. Go to `Service accounts`.
3. Generate a new private key.
4. Download the JSON file.
5. Convert that JSON to a single-line JSON string and place it in:

```bash
FIREBASE_SERVICE_ACCOUNT={...}
```

6. Add it to `.env.local`.
7. Do not commit the JSON file or `.env.local`.

Placeholder links:
- Service accounts page: `https://console.firebase.google.com/project/<your-project-id>/settings/serviceaccounts/adminsdk`
- Admin SDK docs: `https://firebase.google.com/docs/admin/setup`

Expected result:
- Server-side routes can use Firebase Admin SDK for Auth, Firestore, invite creation, and export operations.

## Recipe 5: Create Firestore and deploy the rules
1. Create a Firestore database in Native mode.
2. From the repo root, deploy the rules:

```bash
firebase deploy --only firestore:rules --project <your-project-id>
```

3. If the Firebase CLI is not logged in, run:

```bash
firebase login
```

Placeholder links:
- Firestore console: `https://console.firebase.google.com/project/<your-project-id>/firestore`
- Firestore security rules docs: `https://firebase.google.com/docs/firestore/security/get-started`
- Firebase CLI docs: `https://firebase.google.com/docs/cli`

Expected result:
- The rules in `firestore.rules` are active in your Firebase project.

## Recipe 6: Install dependencies and run the app locally
1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open:

```text
http://localhost:3000
```

Expected result:
- The ClarkFin landing page loads locally.

## Recipe 7: Bootstrap the first platform ADMIN
1. Open:

```text
http://localhost:3000/setup/admin
```

2. Create the first `ADMIN` user.
3. Sign in at:

```text
http://localhost:3000/login
```

Expected result:
- You can access the system admin dashboard at `/app/admin`.

## Recipe 8: Create an organization and default ORG_ADMIN
1. Sign in as the platform `ADMIN`.
2. Open `/app/admin`.
3. Use the organization creation form to create:
   - the organization
   - its per-organization export API key
   - the default `ORG_ADMIN`
4. Save the generated API key somewhere safe.

Expected result:
- The organization exists in Firestore and the default `ORG_ADMIN` can sign in.

## Recipe 9: Create the first semester and invite code
1. Sign in as the `ORG_ADMIN`.
2. Open `/app/org`.
3. Use the semester creation form.
4. Copy the generated invite code.

Expected result:
- The semester is active and students can register through `/invite/<code>`.

## Recipe 10: Verify the API-first workflow
ClarkFin should be treated as API-first, not UI-only.

Minimum checks:
1. Confirm student operations flow through backend APIs.
2. Confirm role restrictions are enforced in APIs, not just in the UI.
3. Confirm `/api/export` works only with the correct `X-API-KEY`.

Placeholder links:
- n8n home: `https://n8n.io/`
- Claude Cowork placeholder: `https://<your-claude-cowork-docs-link>`
- Openclaw placeholder: `https://<your-openclaw-docs-link>`

Expected result:
- The same platform operations can later be consumed by UI users, Claude Cowork, Openclaw, n8n, or other workflow systems.

## Common gotchas
- `auth/invalid-credential` often means wrong password, wrong Firebase project, or Email/Password auth is not enabled.
- `There is no configuration corresponding to the provided identifier.` usually means Firebase Authentication or the web app config is not fully set up.
- Firestore rules do not protect Firebase Admin SDK calls. Server routes still need explicit role and tenancy checks.
- Do not commit:
  - `.env.local`
  - Firebase Admin service account JSON files
  - any raw API keys you want to keep secret

## Open-source maintainer checklist
- Replace placeholder links with real project docs links.
- Add `firestore.indexes.json` if query complexity increases.
- Add seed-data tooling for faster demo setup.
- Add Netlify deployment setup notes for production hosting.

Placeholder links:
- Netlify env var docs: `https://docs.netlify.com/environment-variables/overview/`
- Firebase hosting/deploy docs placeholder: `https://<your-deployment-docs-link>`
