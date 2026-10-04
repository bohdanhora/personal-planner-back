<div align="center">

# Personal Planner API

**Accounts, projects, tasks, statistics and the planning assistant behind Personal Planner.**

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Swagger](https://img.shields.io/badge/OpenAPI-Swagger-85EA2D?logo=swagger&logoColor=black)](https://swagger.io/)

[Frontend repository](https://github.com/bohdanhora/personal-planner)

</div>

## Overview

Personal Planner API is a NestJS REST service for a daily planner that covers both work and personal life. It owns user identity, projects grouped into work and personal areas, tasks placed on days or kept in an inbox, ordering for drag and drop, day schedules, completion statistics, and an assistant, running on the AI provider each person connects with their own key, that turns free text into tasks, plans a day and gives advice.

## Core capabilities

- **Email registration with confirmation** - a six digit code is emailed after sign up, with attempt limits, expiry and a resend cooldown. Sign in is refused until the address is confirmed.
- **Sign in with Google** - a Google ID token is verified server side and linked to an existing account with the same address.
- **Sessions** - short lived JWT access tokens and rotating refresh tokens in an httpOnly cookie.
- **Projects** - short uppercase codes, work or personal area, archive, ordering, open and done counts.
- **Tasks** - a day or the inbox, optional start time and duration, priority, notes, completion time.
- **Drag and drop** - one call places a list of tasks on a day or in the inbox in the given order.
- **Schedules** - one call gives the tasks of a day their start times and order.
- **Carry over** - unfinished tasks from earlier days move to a chosen day.
- **Statistics** - day by day planned and completed tasks, completion rate, focus time, streaks, weekday averages and a project breakdown, computed in a pure domain layer.
- **Assistant** - quick add from free text, tidying a single task into the house style, planning a day inside working hours, specific tips, and a chat that proposes tasks. Every answer is validated and sanitised before it reaches the client.
- **AI provider** - every person picks a provider (Anthropic, OpenAI, Google Gemini, xAI, Groq, OpenRouter or any OpenAI compatible URL), pastes a key and chooses a model from the list the key can reach. The key is stored encrypted with AES-256-GCM and never returned.

## Tech stack

| Area | Technology |
| --- | --- |
| Runtime framework | NestJS 11, Node.js 20+, TypeScript strict mode |
| Database | PostgreSQL 17, Prisma ORM, SQL migrations |
| API documentation | OpenAPI through `@nestjs/swagger` |
| Authentication | JWT, rotating refresh tokens, Passport, bcrypt, Google Identity |
| Email | Nodemailer over SMTP |
| Assistant | OpenAI compatible chat completions on the user's provider, JSON answers validated by Zod |
| Validation | class-validator, class-transformer, global whitelisting |
| Security | helmet, CORS allowlist, throttling |
| Logging | pino through nestjs-pino |
| Testing | Jest, ts-jest |

## Getting started

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The API listens on `http://localhost:4200/api`, the interactive documentation is at `http://localhost:4200/api/docs`.

The seed creates a demo account with a month and a half of history: `admin@admin.com` / `ChangeMe123`.

### Optional services

| Variable | Effect when empty |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Verification codes are written to the server log instead of being emailed |
| `GOOGLE_CLIENT_ID` | The Google button is hidden in the client |

`GET /api/meta` tells the client which of these features are switched on.

`ENCRYPTION_KEY` is required: it encrypts the provider keys people save. Generate one with `openssl rand -hex 32` and keep it stable, changing it makes saved keys unreadable.

## Error format

Every error has the same shape. Domain errors carry a stable `code` the client translates:

```json
{
  "statusCode": 403,
  "error": "FORBIDDEN",
  "code": "EMAIL_NOT_VERIFIED",
  "message": "Confirm your email to sign in",
  "path": "/api/auth/login",
  "timestamp": "2026-10-04T12:00:00.000Z"
}
```

## Project structure

```text
src
  common        crypto, date helpers, validators, error codes, exception filter
  config        environment validation and typed configuration
  domain        pure statistics functions with unit tests
  modules
    auth        registration, confirmation, Google, sessions
    users       profile, language, timezone, working hours
    projects    projects and starter projects for new accounts
    tasks       tasks, ordering, schedules, carry over
    insights    statistics endpoint
    ai-provider provider catalog, encrypted keys, model lists, chat completions
    assistant   prompts, context, JSON answers, sanitising
    meta        optional features for the client
    mail        verification email in English, Russian and Ukrainian
  prisma        Prisma client provider
prisma          schema, migrations, seed
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start in watch mode |
| `npm run build` | Compile to `dist` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emitting |
| `npm test` | Unit tests |
| `npm run db:migrate` | Create and apply migrations |
| `npm run db:seed` | Recreate the demo account |

## Docker

```bash
docker compose --profile api up -d --build
```

The image applies pending migrations on start.
