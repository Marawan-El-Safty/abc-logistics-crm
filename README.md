# SAFTYGROUP CRM

**Internal Sales CRM for SAFTYGROUP — International Freight Forwarding & Logistics**

> Delivering Your Success · Alexandria, Egypt · Founded 2006

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Tailwind CSS (PWA) |
| Backend | Node.js + Express |
| Database | PostgreSQL 16 |
| Auth | JWT + Refresh Token Rotation |
| PDF | PDFKit (branded quotation PDFs) |
| Excel | ExcelJS (.xlsx export) |
| Deployment | Docker + Nginx |

---

## Quick Start

### Option 1 — Docker Compose (Recommended)

```bash
# Copy env file
cp backend/.env.example backend/.env
# Edit DB password, JWT secrets in backend/.env

docker-compose up -d
```

Access at: http://localhost:3000

### Option 2 — Manual

**Prerequisites:** Node.js 18+, PostgreSQL 14+

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Setup database
createdb saftygroup_crm
cd ../backend && npm run db:migrate && npm run db:seed

# Start backend (terminal 1)
npm run dev

# Start frontend (terminal 2)
cd ../frontend && npm start
```

---

## Default Login Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@saftygroup.com | Admin@SAFTY2024 |
| Sales Manager | manager@saftygroup.com | Admin@SAFTY2024 |
| Sales Rep | ahmed@saftygroup.com | Admin@SAFTY2024 |

> **Important:** Change all passwords immediately after first login!

---

## Features

### Modules
- **Dashboard** — KPI cards, pipeline overview, follow-ups, team performance
- **Clients** — Company profiles, multiple contacts/branches, communication history
- **Leads Pipeline** — Kanban + list view, 5-stage pipeline, auto-convert to client on Win
- **Quotations** — Multi-charge quotations, branded PDF generation, approve workflow
- **Activities** — Log calls/meetings/emails/WhatsApp, follow-up reminders
- **Tasks** — Priority tasks with calendar view
- **Open Requests** — Internal request board with 3-column status view
- **Invoices** — EGP/USD dual currency, payment tracking, overdue alerts
- **Reports** — Performance per rep, KPIs, pipeline breakdown, Excel export
- **User Management** — RBAC with 3 roles (Admin, Sales Manager, Sales Rep)

### Integrations
- **Website Form Webhook** — `POST /api/leads/inbound` auto-creates leads from the SAFTYGROUP website contact form
- **PDF** — Branded quotation PDFs with logo, all charges, company info
- **Excel Export** — `.xlsx` export for all reports with SAFTYGROUP branding
- **PWA** — Offline support with local sync queue

### Security
- JWT access tokens (15min) + refresh token rotation (7 days)
- Role-based access control (RBAC) for all 3 roles
- Rate limiting on API and login endpoints
- Helmet.js security headers
- Bcrypt password hashing (12 rounds)
- Soft deletes on all major entities
- Full audit log of all user actions

---

## API Endpoints

### Auth
- `POST /api/auth/login` — Login
- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Current user

### Website Integration
- `POST /api/leads/inbound` — **Public** webhook for website quote form

### Core Resources
- `/api/clients` — CRUD + contacts + branches + contracts
- `/api/leads` — CRUD + stage transitions
- `/api/quotations` — CRUD + PDF generation + approval
- `/api/activities` — CRUD + today's follow-ups
- `/api/tasks` — CRUD + calendar view
- `/api/requests` — Open requests management
- `/api/invoices` — Invoice tracking
- `/api/reports` — Dashboard, performance, pipeline, Excel export
- `/api/notifications` — User notifications
- `/api/users` — User management (Admin only)

---

## Database Schema

16 tables with full foreign key relationships, indexes, triggers for `updated_at`, and soft deletes:

`users` · `roles` · `refresh_tokens` · `clients` · `client_contacts` · `client_branches` · `leads` · `quotations` · `quotation_charges` · `activities` · `tasks` · `open_requests` · `contracts` · `invoices` · `communication_log` · `notifications` · `audit_log`

---

## Company Info

**SAFTYGROUP**  
6 Abdelfattah Yahia St - Raml Station, Alexandria, Egypt  
📧 sales@saftygroup.com | pricing@saftygroup.com  
📞 +20 111 8 111 463 | +20 111 74 35 782  
🌐 saftygroup.com
