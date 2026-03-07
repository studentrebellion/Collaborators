# GRE Practice Test Platform - Implementation Plan

## Architecture Overview

### Frontend (Vercel) - Next.js App
- **Auth**: NextAuth.js with credentials/OAuth
- **UI**: The existing Mock Test Adaptive.html converted into React components
- **Features**: Test taking, pause/resume, review, commenting

### Backend (Railway)
- **DB**: PostgreSQL on Railway
- **API**: Next.js API routes (deployed with frontend on Vercel, but DB on Railway)

## Database Schema (PostgreSQL on Railway)

### Tables:
1. **users** - User profiles synced from NextAuth
2. **test_sessions** - Tracks test progress (pause/resume state)
3. **test_results** - Completed test results
4. **question_comments** - User comments on individual questions

## Tech Stack
- Next.js 14 (App Router)
- NextAuth.js for authentication
- Prisma ORM for PostgreSQL
- PostgreSQL on Railway
- Frontend deployed on Vercel

## Implementation Steps

### Phase 1: Project Setup
1. Initialize Next.js project
2. Install dependencies (NextAuth, Prisma, etc.)
3. Configure Prisma with Railway PostgreSQL

### Phase 2: Database Schema
1. Create Prisma schema with all tables
2. Run migrations on Railway PostgreSQL

### Phase 3: Authentication
1. Configure NextAuth with credentials provider
2. Add role-based access (USER, ADMIN)
3. Create sign-in/sign-up pages

### Phase 4: Test Interface
1. Convert Mock Test Adaptive.html into Next.js pages
2. Implement pause/resume with TestSessions table
3. Save drafts as JSON (current_answers field)

### Phase 5: Review & Comments
1. Test review page showing results
2. Question-level commenting system

### Phase 6: Admin Dashboard
1. Admin middleware checking role
2. Dashboard showing all TestSessions
3. View individual user sessions

### Phase 7: Deployment
1. Push to GitHub
2. Connect to Vercel
3. Configure Railway PostgreSQL
