-- SAFTYGROUP CRM - PostgreSQL Schema
-- Version 1.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ROLES & USERS
-- ============================================================
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id       INTEGER NOT NULL REFERENCES roles(id),
    full_name     VARCHAR(150) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone         VARCHAR(50),
    avatar_url    TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_at        TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_minutes NUMERIC(8,2),
    logout_reason    VARCHAR(20) DEFAULT 'manual'
);
CREATE INDEX idx_user_sessions_user  ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_login ON user_sessions(login_at);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TYPE industry_type AS ENUM (
    'Freight Forwarder',
    'Exporter',
    'Importer',
    'Manufacturer',
    'Logistics Agent',
    'Other'
);

CREATE TABLE clients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name    VARCHAR(255) NOT NULL,
    industry        industry_type NOT NULL DEFAULT 'Other',
    country         VARCHAR(100),
    address         TEXT,
    website         VARCHAR(255),
    notes           TEXT,
    assigned_to     UUID REFERENCES users(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    contact_type    VARCHAR(20) NOT NULL DEFAULT 'Client' CHECK (contact_type IN ('Client','Freight Forwarder','Carrier')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE client_contacts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    full_name    VARCHAR(150) NOT NULL,
    title        VARCHAR(100),
    phone        VARCHAR(50),
    email        VARCHAR(255),
    whatsapp     VARCHAR(50),
    is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE client_branches (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name       VARCHAR(150) NOT NULL,
    country    VARCHAR(100),
    address    TEXT,
    phone      VARCHAR(50),
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEADS
-- ============================================================
CREATE TYPE lead_stage AS ENUM (
    'New Lead',
    'Contacted',
    'Proposal Sent',
    'Negotiating',
    'Won',
    'Lost'
);

CREATE TYPE lead_source AS ENUM (
    'Website Form',
    'Manual Entry',
    'Referral',
    'Email',
    'Phone',
    'Other'
);

CREATE TYPE shipment_type AS ENUM (
    'Sea Freight FCL',
    'Sea Freight LCL',
    'Air Freight',
    'Inland Trucking',
    'Customs Clearance',
    'Storage & Warehousing',
    'Mixed'
);

CREATE TABLE leads (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_name     VARCHAR(150) NOT NULL,
    company_name     VARCHAR(255),
    email            VARCHAR(255),
    phone            VARCHAR(50),
    shipment_type    shipment_type,
    origin           VARCHAR(255),
    destination      VARCHAR(255),
    cargo_details    TEXT,
    weight           NUMERIC(12,2),
    volume           NUMERIC(12,2),
    weight_unit      VARCHAR(20) DEFAULT 'kg',
    volume_unit      VARCHAR(20) DEFAULT 'CBM',
    notes            TEXT,
    stage            lead_stage NOT NULL DEFAULT 'New Lead',
    source           lead_source NOT NULL DEFAULT 'Manual Entry',
    assigned_to      UUID REFERENCES users(id),
    created_by       UUID NOT NULL REFERENCES users(id),
    converted_to     UUID REFERENCES clients(id),
    converted_at     TIMESTAMPTZ,
    lost_reason      TEXT,
    stage_new_lead_at       TIMESTAMPTZ,
    stage_contacted_at      TIMESTAMPTZ,
    stage_proposal_at       TIMESTAMPTZ,
    stage_negotiating_at    TIMESTAMPTZ,
    stage_won_at            TIMESTAMPTZ,
    stage_lost_at           TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);

-- ============================================================
-- QUOTATIONS
-- ============================================================
CREATE TYPE service_type AS ENUM (
    'Sea Freight FCL',
    'Sea Freight LCL',
    'Air Freight',
    'Inland Trucking',
    'Customs Clearance',
    'Storage & Warehousing'
);

CREATE TYPE currency_type AS ENUM ('EGP', 'USD', 'EUR');

CREATE TYPE quotation_status AS ENUM ('Draft', 'Sent', 'Accepted', 'Rejected');

CREATE TABLE quotations (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_no     VARCHAR(50) NOT NULL UNIQUE,
    client_id        UUID REFERENCES clients(id),
    lead_id          UUID REFERENCES leads(id),
    service_type     service_type NOT NULL,
    origin           VARCHAR(255) NOT NULL,
    destination      VARCHAR(255) NOT NULL,
    cargo_type       VARCHAR(255),
    weight           NUMERIC(12,2),
    volume           NUMERIC(12,2),
    weight_unit      VARCHAR(20) DEFAULT 'kg',
    volume_unit      VARCHAR(20) DEFAULT 'CBM',
    transit_time     VARCHAR(100),
    free_days        INTEGER,
    currency         currency_type NOT NULL DEFAULT 'USD',
    total_amount     NUMERIC(14,2),
    status           quotation_status NOT NULL DEFAULT 'Draft',
    valid_until      DATE,
    notes            TEXT,
    pdf_url          TEXT,
    created_by       UUID NOT NULL REFERENCES users(id),
    approved_by      UUID REFERENCES users(id),
    approved_at      TIMESTAMPTZ,
    sent_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);

CREATE TYPE charge_category AS ENUM (
    'B/L Charges',
    'Local Charges',
    'Destination Charges',
    'Freight',
    'Insurance',
    'Other'
);

CREATE TABLE quotation_charges (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    category    charge_category NOT NULL DEFAULT 'Other',
    description VARCHAR(255) NOT NULL,
    amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency    currency_type NOT NULL DEFAULT 'USD',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACTIVITIES & FOLLOW-UPS
-- ============================================================
CREATE TYPE activity_type AS ENUM (
    'Call',
    'Meeting',
    'Email',
    'Site Visit',
    'WhatsApp',
    'Note'
);

CREATE TABLE activities (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_type    activity_type NOT NULL,
    client_id        UUID REFERENCES clients(id),
    lead_id          UUID REFERENCES leads(id),
    performed_by     UUID NOT NULL REFERENCES users(id),
    activity_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes            TEXT,
    outcome          TEXT,
    next_follow_up   TIMESTAMPTZ,
    follow_up_notes  TEXT,
    reminder_sent    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent');
CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Done');

CREATE TABLE tasks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    due_date     TIMESTAMPTZ,
    priority     task_priority NOT NULL DEFAULT 'Medium',
    status       task_status NOT NULL DEFAULT 'To Do',
    assigned_to  UUID NOT NULL REFERENCES users(id),
    assigned_by  UUID REFERENCES users(id),
    client_id    UUID REFERENCES clients(id),
    lead_id      UUID REFERENCES leads(id),
    created_by   UUID NOT NULL REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

-- ============================================================
-- OPEN REQUESTS
-- ============================================================
CREATE TYPE request_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent');
CREATE TYPE request_status AS ENUM ('Open', 'In Progress', 'Closed');

CREATE TABLE open_requests (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    priority     request_priority NOT NULL DEFAULT 'Medium',
    status       request_status NOT NULL DEFAULT 'Open',
    client_id    UUID REFERENCES clients(id),
    submitted_by UUID NOT NULL REFERENCES users(id),
    assigned_to  UUID REFERENCES users(id),
    resolution   TEXT,
    closed_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

-- ============================================================
-- CONTRACTS
-- ============================================================
CREATE TABLE contracts (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title         VARCHAR(255) NOT NULL,
    file_url      TEXT,
    file_name     VARCHAR(255),
    file_size     INTEGER,
    start_date    DATE,
    end_date      DATE,
    notes         TEXT,
    uploaded_by   UUID NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TYPE payment_status AS ENUM ('Pending', 'Paid', 'Overdue');

CREATE TABLE invoices (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id      UUID NOT NULL REFERENCES clients(id),
    quotation_id   UUID REFERENCES quotations(id),
    invoice_no     VARCHAR(50) NOT NULL UNIQUE,
    description    TEXT NOT NULL,
    amount         NUMERIC(14,2) NOT NULL,
    currency       currency_type NOT NULL DEFAULT 'USD',
    due_date       DATE NOT NULL,
    paid_at        TIMESTAMPTZ,
    payment_status payment_status NOT NULL DEFAULT 'Pending',
    notes          TEXT,
    created_by     UUID NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
);

-- ============================================================
-- COMMUNICATION LOG
-- ============================================================
CREATE TYPE comm_direction AS ENUM ('Inbound', 'Outbound');
CREATE TYPE comm_channel AS ENUM ('Email', 'WhatsApp', 'Phone', 'In-Person', 'Portal');

CREATE TABLE communication_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id   UUID REFERENCES clients(id),
    lead_id     UUID REFERENCES leads(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    direction   comm_direction NOT NULL DEFAULT 'Outbound',
    channel     comm_channel NOT NULL DEFAULT 'Email',
    subject     VARCHAR(255),
    body        TEXT,
    metadata    JSONB DEFAULT '{}',
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TYPE notification_type AS ENUM (
    'follow_up_due',
    'task_due',
    'lead_assigned',
    'quotation_status',
    'request_updated',
    'invoice_overdue',
    'system'
);

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type NOT NULL,
    title       VARCHAR(255) NOT NULL,
    body        TEXT,
    link        VARCHAR(500),
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id   UUID,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_clients_assigned ON clients(assigned_to);
CREATE INDEX idx_clients_created_by ON clients(created_by);
CREATE INDEX idx_clients_company ON clients USING GIN (company_name gin_trgm_ops);
CREATE INDEX idx_clients_deleted ON clients(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_deleted ON leads(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_quotations_client ON quotations(client_id);
CREATE INDEX idx_quotations_lead ON quotations(lead_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_ref ON quotations(reference_no);
CREATE INDEX idx_quotations_deleted ON quotations(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_activities_client ON activities(client_id);
CREATE INDEX idx_activities_lead ON activities(lead_id);
CREATE INDEX idx_activities_performer ON activities(performed_by);
CREATE INDEX idx_activities_follow_up ON activities(next_follow_up) WHERE next_follow_up IS NOT NULL;

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_tasks_deleted ON tasks(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_open_requests_status ON open_requests(status);
CREATE INDEX idx_open_requests_submitted ON open_requests(submitted_by);
CREATE INDEX idx_open_requests_deleted ON open_requests(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(payment_status);
CREATE INDEX idx_invoices_due ON invoices(due_date);
CREATE INDEX idx_invoices_deleted ON invoices(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_comm_log_client ON communication_log(client_id);
CREATE INDEX idx_comm_log_lead ON communication_log(lead_id);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_client_contacts_updated_at BEFORE UPDATE ON client_contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_client_branches_updated_at BEFORE UPDATE ON client_branches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_open_requests_updated_at BEFORE UPDATE ON open_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
