# Queue Desk

A queue management app for busy counters, built with the **MERN stack** (MongoDB, Express, React, Node). A manager signs in, opens named queues, and issues a numbered token to everyone who joins. The person at the top can be assigned for service with one click, the rest of the line can be reordered or cancelled, and an insights dashboard keeps the wait honest.

## Features

1. **Sign in** with email and password. Signed-in managers can change their password, and a forgotten one can be reset from a one-time link.
2. **Create queues.** Each queue has a name and a short code, such as `A` or `P`. Both can be edited later.
3. **Add people.** Adding someone issues the next token, for example `A-014`. Token numbers are never reused.
4. **See the line.** Everyone still waiting is listed in order, with how long they have waited.
5. **Reorder.** Drag a person to a new spot, or use the up and down arrows.
6. **Assign for service.** One button calls the person at the top. If someone is already being served, that service is finished first.
7. **Cancel a token**, with a confirm step.
8. **Insights dashboard.** Who is waiting now, average and longest wait, queue length over the day, average wait by queue, and who was just served or cancelled.
9. **Light and dark mode.** The toggle is the labeled button at the bottom of the sidebar (on sign-in pages, top right).

**Load demo data** adds two queues with a realistic morning of waits so the dashboard and charts have something to show. It only affects your own account.

## Tech stack

| Layer    | Tools                                                                      |
| -------- | -------------------------------------------------------------------------- |
| Frontend | React 19, Vite, TanStack Router and Query, Tailwind CSS v4, Recharts       |
| Backend  | Node 22, Express 5, TypeScript, Zod for validation                         |
| Database | MongoDB with Mongoose                                                      |
| Auth     | bcrypt password hashes, JWT in an HttpOnly cookie, rate limiting, Helmet   |
| Tests    | Node's test runner against a real in-memory MongoDB (`mongodb-memory-server`) |

## How it works

```
client/   React single-page app (Vite)
server/   Express REST API + MongoDB models
```

In development, Vite serves the React app on port 3000 and proxies `/api` to Express on port 4000. In production, Express serves the built React app too, so one service hosts everything on one origin.

### REST API

All routes except `/api/auth/*` need a signed-in session.

| Method and path                      | Purpose                                         |
| ------------------------------------ | ----------------------------------------------- |
| `POST /api/auth/register`            | Create an account and sign in                   |
| `POST /api/auth/login`, `/logout`    | Sign in and out                                 |
| `GET /api/auth/me`                   | Who is signed in (`user: null` if nobody)       |
| `POST /api/auth/forgot-password`     | Email a reset link                              |
| `POST /api/auth/reset-password`      | Set a new password with the emailed token       |
| `POST /api/auth/change-password`     | Change password (needs the current one)         |
| `GET/POST /api/queues`               | List queues and create one                      |
| `PATCH/DELETE /api/queues/:id`       | Edit or delete a queue                          |
| `GET/POST /api/queues/:id/tokens`    | List the line and add a person                  |
| `POST /api/queues/:id/call-next`     | Assign the top token for service                |
| `POST /api/queues/:id/finish`        | Finish the current service                      |
| `POST /api/tokens/:id/cancel`        | Cancel a token                                  |
| `PATCH /api/tokens/:id/position`     | Reorder: `{ direction }` or `{ toIndex }`       |
| `GET /api/insights?range=today\|week` | Analytics for the dashboard                    |
| `POST /api/demo`                     | Load demo data                                  |

### Data model (MongoDB)

- **User**: name, email (unique), password hash.
- **Queue**: owner, name, code (unique per owner) and the next token number.
- **Token**: queue, number, person, note, status (`waiting`, `serving`, `served`, `cancelled`), position and the timestamps used for wait and service time.
- **Snapshot**: waiting count after each change, which is what the queue length chart reads.
- **PasswordReset**: hashed one-time token with an expiry (MongoDB removes expired ones itself).

### Security notes

- Every query is scoped to the signed-in manager, so one account cannot read or change another's queues (covered by tests).
- Passwords are hashed with bcrypt and never returned by the API.
- The session cookie is `HttpOnly` and `SameSite=Lax`, and cross-site writes are rejected by an Origin check.
- Sign-in, sign-up and reset requests are rate limited. Reset tokens are stored hashed and work once.

## Run locally

You need Node 22 (for example through [nvm](https://github.com/nvm-sh/nvm): `nvm install 22`).

```bash
npm install
npm run dev
```

Open http://localhost:3000, create an account, and either add a queue or load demo data.

With no `MONGODB_URI` set, the API starts an **in-memory MongoDB**, so nothing needs installing. The first run downloads a MongoDB binary once, and data resets whenever the server restarts.

### Use a real MongoDB locally

Copy `.env.example` to `.env`, uncomment `MONGODB_URI`, and point it at a local MongoDB or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

### Password reset

- **Change password** (signed in): Profile page, no email needed. Other devices are signed out.
- **Forgot password** (signed out): locally, the reset link is printed in the terminal running `npm run dev`.
- **Real emails:** set `RESEND_API_KEY` and `RESET_EMAIL_FROM` (Resend only emails addresses other than your own once a domain is verified).
- **Demo sites:** set `DEMO_SHOW_RESET_LINK=true` and the page shows the reset link on screen instead of emailing it. This lets anyone who knows an email reset that account, so use it only on a throwaway demo with no real users. The included `render.yaml` turns it on for the demo deployment.

## Scripts

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Start the API (port 4000) and the React app (port 3000) |
| `npm run build`     | Build the React app and compile the server             |
| `npm start`         | Run the production server (needs `MONGODB_URI`, `JWT_SECRET`) |
| `npm test`          | API integration tests plus unit tests                  |
| `npm run typecheck` | Type-check the client and the server                   |
| `npm run lint`      | Lint the code                                          |

## Deploy for free (Render and MongoDB Atlas)

1. **Database.** Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas). Add a database user, allow access from anywhere (`0.0.0.0/0`) under Network Access, and copy the connection string.
2. **Code.** Push this repo to GitHub.
3. **Hosting.** On [render.com](https://render.com) choose **New, Blueprint** and pick the repo. It reads `render.yaml`. When asked, set:
   - `MONGODB_URI`: the Atlas connection string, ending in `/queue-desk`
   - `APP_URL`: the service URL, for example `https://queue-desk.onrender.com`
   - `JWT_SECRET` is generated for you.
4. Deploy. Render builds the app and starts it. The health check is `/api/health`.

The free Render plan puts the service to sleep after about 15 minutes without traffic, so the first request after a pause takes around 30 to 60 seconds. Open the site once before sharing it.
