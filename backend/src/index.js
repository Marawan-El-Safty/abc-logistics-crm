require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs');

const errorHandler = require('./middleware/errorHandler');
const { checkDueFollowUps, checkOverdueInvoices, warnExpiringTrials } = require('./services/notificationService');
const { pool } = require('./config/db');

async function autoMigrate() {
  const { rows } = await pool.query(
    `SELECT to_regclass('public.roles') AS exists`
  );
  const isNewDb = !rows[0].exists;
  if (isNewDb) {
    console.log('Running database migration...');
    const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Schema applied.');
  }
  // Incremental migrations
  await pool.query(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS product_type VARCHAR(255)
  `);
  await pool.query(`ALTER TYPE industry_type ADD VALUE IF NOT EXISTS 'Trading'`);
  await pool.query(`ALTER TYPE charge_category ADD VALUE IF NOT EXISTS 'Custom Clearance'`);
  await pool.query(`ALTER TYPE charge_category ADD VALUE IF NOT EXISTS 'Inland Charges'`);
  await pool.query(`ALTER TYPE charge_category ADD VALUE IF NOT EXISTS 'Official Receipts'`);
  await pool.query(`
    ALTER TABLE quotations
      ADD COLUMN IF NOT EXISTS incoterms VARCHAR(50),
      ADD COLUMN IF NOT EXISTS incoterm_other VARCHAR(255),
      ADD COLUMN IF NOT EXISTS pickup_location VARCHAR(255)
  `);
  await pool.query(`ALTER TYPE industry_type ADD VALUE IF NOT EXISTS 'Shipping Lines'`);
  await pool.query(`ALTER TYPE quotation_status ADD VALUE IF NOT EXISTS 'Approved'`);
  await pool.query(`ALTER TYPE quotation_status ADD VALUE IF NOT EXISTS 'Pending Review'`);
  // 'Confirmed' = the client accepted the quotation (distinct from manager 'Approved')
  await pool.query(`ALTER TYPE quotation_status ADD VALUE IF NOT EXISTS 'Confirmed'`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS review_notes TEXT`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`);
  await pool.query(`
    ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_contact_type_check;
    ALTER TABLE clients ADD CONSTRAINT clients_contact_type_check
      CHECK (contact_type IN ('Client','Freight Forwarder','Carrier','Supplier','Trader'));
  `);
  await pool.query(`
    ALTER TABLE quotation_charges
      ADD COLUMN IF NOT EXISTS qty        DECIMAL(10,4) DEFAULT 1,
      ADD COLUMN IF NOT EXISTS unit_rate  DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS buying_rate DECIMAL(12,2)
  `);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS buying_total DECIMAL(12,2)`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buying_total DECIMAL(12,2)`);
  await pool.query(`
    ALTER TABLE quotations
      ADD COLUMN IF NOT EXISTS carrier VARCHAR(255),
      ADD COLUMN IF NOT EXISTS show_carrier_in_pdf BOOLEAN DEFAULT FALSE
  `);
  // Invoice extra fields for PDF generation
  await pool.query(`
    ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS bl_number     VARCHAR(100),
      ADD COLUMN IF NOT EXISTS vessel        VARCHAR(255),
      ADD COLUMN IF NOT EXISTS shipping_line VARCHAR(255),
      ADD COLUMN IF NOT EXISTS client_vat    VARCHAR(100)
  `);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pol              VARCHAR(120)`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pod              VARCHAR(120)`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS container_type   VARCHAR(80)`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS container_qty    INTEGER`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cargo_type       VARCHAR(100)`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS custom_invoice_no VARCHAR(100)`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS shipment_type    VARCHAR(80)`);
  // Delivery location for incoterms (Door to Door, DAP, DDP, etc.)
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_location VARCHAR(255)`);
  // Trade direction (Import / Export / Domestic) for filtering
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS direction VARCHAR(20)`);
  // Bank accounts table + link invoices to a bank account
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_name   VARCHAR(255) NOT NULL,
      account_number VARCHAR(100),
      currency       VARCHAR(10)  NOT NULL DEFAULT 'USD',
      iban           VARCHAR(100),
      bank_name      VARCHAR(255),
      bank_address   VARCHAR(500),
      swift_code     VARCHAR(50),
      is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
      notes          VARCHAR(500),
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id)`);
  // Shipping line rates table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_rates (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipping_line VARCHAR(255) NOT NULL,
      pol           VARCHAR(255) NOT NULL,
      pod           VARCHAR(255) NOT NULL,
      service_type  VARCHAR(10)  NOT NULL DEFAULT 'FCL',
      rate_20dc     DECIMAL(12,2),
      rate_40dc     DECIMAL(12,2),
      rate_40hc     DECIMAL(12,2),
      rate_lcl      DECIMAL(12,2),
      currency      VARCHAR(10)  NOT NULL DEFAULT 'USD',
      transit_time  VARCHAR(100),
      free_days     INTEGER,
      valid_from    DATE NOT NULL DEFAULT CURRENT_DATE,
      valid_to      DATE NOT NULL,
      notes         TEXT,
      created_by    UUID REFERENCES users(id),
      deleted_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Invoice line-item charges for standalone invoices (not linked to a quotation)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_charges (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description VARCHAR(500) NOT NULL,
      category    VARCHAR(100),
      qty         DECIMAL(10,4) DEFAULT 1,
      unit_rate   DECIMAL(12,2),
      amount      DECIMAL(12,2) NOT NULL,
      currency    VARCHAR(10) NOT NULL DEFAULT 'USD',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Attachment support on open requests
  await pool.query(`ALTER TABLE open_requests ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'`);
  await pool.query(`ALTER TABLE open_requests ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE`);

  // Request replies (threaded comments on open requests)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS request_replies (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES open_requests(id) ON DELETE CASCADE,
      author_id  UUID NOT NULL REFERENCES users(id),
      message    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Finance role
  await pool.query(`
    INSERT INTO roles (name, description, permissions)
    SELECT 'Finance', 'Access to invoices and financial data', '{
      "invoices": ["create","read","update","delete"],
      "clients": ["read"],
      "quotations": ["read"],
      "reports": ["read"]
    }'
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Finance')
  `);
  // Operation role — books vessels from client-confirmed quotations
  await pool.query(`
    INSERT INTO roles (name, description, permissions)
    SELECT 'Operation', 'Books vessels from client-confirmed quotations', '{
      "quotations": ["create","read","update"],
      "clients": ["read","create","update"],
      "shipping_rates": ["read"]
    }'
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Operation')
  `);
  // Global app settings — single JSONB row (company info, PDF/bank defaults,
  // default currency, session timeouts). Replaces hardcoded values.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id         INT PRIMARY KEY DEFAULT 1,
      data       JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT app_settings_single_row CHECK (id = 1)
    )
  `);
  await pool.query(`INSERT INTO app_settings (id, data) VALUES (1, '{}') ON CONFLICT (id) DO NOTHING`);
  // Audit log — who did what to which record
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID REFERENCES users(id),
      user_name    VARCHAR(255),
      action       VARCHAR(40)  NOT NULL,
      entity_type  VARCHAR(40)  NOT NULL,
      entity_id    UUID,
      entity_label VARCHAR(255),
      details      JSONB,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC)`);
  // Shipments / bookings register (Operations) — digital version of the
  // Export/Import tracking spreadsheets
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipments (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reference      VARCHAR(120),
      direction      VARCHAR(20),                 -- Export / Import / Domestic
      care_of        VARCHAR(255),
      shipping_line  VARCHAR(255),
      client_id      UUID REFERENCES clients(id),
      client_name    VARCHAR(255),                -- fallback for manual entries
      pol            VARCHAR(255),
      pod            VARCHAR(255),
      booking_no     VARCHAR(255),
      container_qty  INTEGER,
      container_type VARCHAR(60),
      status         VARCHAR(40) NOT NULL DEFAULT 'Booked',
      note           TEXT,
      loading_note   VARCHAR(500),
      etd            DATE,
      eta            DATE,
      quotation_id   UUID REFERENCES quotations(id),
      created_by     UUID REFERENCES users(id),
      deleted_at     TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipments_created ON shipments (created_at DESC)`);
  // Old/internal reference to link imported sheet bookings to CRM references
  await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS external_ref VARCHAR(120)`);
  await pool.query(`
    ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS acid        VARCHAR(100),
      ADD COLUMN IF NOT EXISTS master_acid VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bl_number   VARCHAR(100)
  `);
  await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS loading_date DATE`);

  // ── Performance indexes ────────────────────────────────────────────────────
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipments_direction   ON shipments (direction) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipments_status      ON shipments (status)    WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipments_archived    ON shipments (is_archived, direction) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date        ON tasks (due_date)      WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status          ON tasks (status)        WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned        ON tasks (assigned_to)   WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotations_status     ON quotations (status)   WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotations_updated    ON quotations (updated_at DESC) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_assigned        ON leads (assigned_to)   WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_stage           ON leads (stage)         WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activities_date       ON activities (activity_date DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activities_performer  ON activities (performed_by)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications (user_id, is_read, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_open_requests_status  ON open_requests (status) WHERE deleted_at IS NULL`);

  // Shipment attachments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipment_attachments (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      filename    VARCHAR(255) NOT NULL,
      stored_as   VARCHAR(255) NOT NULL,
      url         VARCHAR(500) NOT NULL,
      size        INTEGER,
      mime        VARCHAR(100),
      uploaded_by UUID REFERENCES users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Sales Invoices (proforma — no bank details, product-line table)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_no      VARCHAR(50) NOT NULL,
      client_id       UUID REFERENCES clients(id),
      client_name     VARCHAR(255),
      client_address  TEXT,
      vessel_validity DATE,
      shipment_details TEXT,
      pol             VARCHAR(120),
      pod             VARCHAR(120),
      container_type  VARCHAR(80),
      currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
      items           JSONB NOT NULL DEFAULT '[]',
      total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
      status          VARCHAR(30) NOT NULL DEFAULT 'Draft',
      notes           TEXT,
      created_by      UUID REFERENCES users(id),
      deleted_at      TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS pol              VARCHAR(120)`);
  await pool.query(`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS pod              VARCHAR(120)`);
  await pool.query(`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS container_type   VARCHAR(80)`);
  await pool.query(`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS custom_invoice_no VARCHAR(100)`);

  // Notification preferences per user (map of type → boolean)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'`);

  // Quotation version snapshots (before each update)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotation_versions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quotation_id  UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      version_no    INTEGER NOT NULL DEFAULT 1,
      snapshot      JSONB NOT NULL,
      changed_by    UUID REFERENCES users(id),
      changed_by_name VARCHAR(255),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quot_versions ON quotation_versions (quotation_id, version_no DESC)`);

  // House Bill of Lading documents
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bl_documents (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id     UUID REFERENCES shipments(id),
      bl_no           VARCHAR(100),
      booking_no      VARCHAR(100),
      shipper         TEXT,
      consignee       TEXT,
      notify_party    TEXT,
      also_notify     TEXT,
      pre_carriage    VARCHAR(255),
      place_of_receipt VARCHAR(255),
      pol             VARCHAR(255),
      pod             VARCHAR(255),
      final_destination VARCHAR(255),
      vessel          VARCHAR(255),
      voyage_no       VARCHAR(100),
      place_of_delivery VARCHAR(255),
      container_no    VARCHAR(255),
      no_of_pkgs      VARCHAR(100),
      description     TEXT,
      gross_weight    VARCHAR(100),
      measurement     VARCHAR(100),
      freight_charges TEXT,
      payment_terms   VARCHAR(100),
      place_issued    VARCHAR(255),
      date_issued     DATE,
      no_of_originals INTEGER DEFAULT 3,
      delivery_agent  TEXT,
      status          VARCHAR(20) NOT NULL DEFAULT 'Draft',
      created_by      UUID REFERENCES users(id),
      deleted_at      TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE bl_documents ADD COLUMN IF NOT EXISTS containers JSONB`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS options JSONB`);

  // User profile extras
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(150)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS salutation VARCHAR(20)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone2 VARCHAR(50)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone3 VARCHAR(50)`);

  // Email campaigns
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
      template     VARCHAR(100) NOT NULL,
      subject      TEXT NOT NULL,
      body         TEXT NOT NULL,
      recipient    VARCHAR(255) NOT NULL,
      status       VARCHAR(20)  NOT NULL DEFAULT 'sent',
      error        TEXT,
      sent_by      UUID REFERENCES users(id),
      sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Multi-tenant SaaS migration ────────────────────────────────────────────

  // Plans table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(50) UNIQUE NOT NULL,
      price_per_seat DECIMAL(10,2) NOT NULL DEFAULT 0,
      features    JSONB NOT NULL DEFAULT '{}',
      limits      JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Seed plans (idempotent)
  await pool.query(`
    INSERT INTO plans (name, price_per_seat, features, limits) VALUES
    ('starter', 15, '{"sales_invoices":false,"bl_documents":false,"reports_export":false,"audit_log":false}',
     '{"shipments_per_month":50,"clients":200,"seats":3}'),
    ('professional', 25, '{"sales_invoices":true,"bl_documents":true,"reports_export":true,"audit_log":false}',
     '{"shipments_per_month":500,"clients":2000,"seats":15}'),
    ('enterprise', 40, '{"sales_invoices":true,"bl_documents":true,"reports_export":true,"audit_log":true}',
     '{"shipments_per_month":99999,"clients":99999,"seats":99999}')
    ON CONFLICT (name) DO NOTHING
  `);

  // Tenants table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name   VARCHAR(255) NOT NULL,
      slug           VARCHAR(63) UNIQUE NOT NULL,
      plan_id        UUID REFERENCES plans(id),
      seat_limit     INTEGER NOT NULL DEFAULT 3,
      status         VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','suspended','canceled')),
      trial_ends_at  TIMESTAMPTZ,
      valid_until    TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tenant zero (backfill tenant for existing single-tenant data)
  await pool.query(`
    INSERT INTO tenants (id, company_name, slug, status, seat_limit)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'default', 'active', 999)
    ON CONFLICT (id) DO NOTHING
  `);

  // Assign starter plan to tenant zero if not set
  await pool.query(`
    UPDATE tenants t SET plan_id = (SELECT id FROM plans WHERE name='enterprise')
    WHERE t.id = '00000000-0000-0000-0000-000000000001' AND t.plan_id IS NULL
  `);

  // Add tenant_id to users
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token VARCHAR(255)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (user_status IN ('active','pending','suspended'))`);

  // Backfill users with tenant zero
  await pool.query(`UPDATE users SET tenant_id='00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL`);

  // Ensure core tables exist that were only in schema.sql (not in incremental migrations).
  // Safe on existing DBs — IF NOT EXISTS is a no-op.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      login_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      logout_at        TIMESTAMPTZ,
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_minutes NUMERIC(8,2),
      logout_reason    VARCHAR(20) DEFAULT 'manual'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_contacts (
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
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_branches (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name       VARCHAR(150) NOT NULL,
      country    VARCHAR(100),
      address    TEXT,
      phone      VARCHAR(50),
      notes      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotation_charges (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      description  VARCHAR(255) NOT NULL,
      amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency     VARCHAR(10) NOT NULL DEFAULT 'USD',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      activity_type   VARCHAR(50) NOT NULL,
      client_id       UUID REFERENCES clients(id),
      lead_id         UUID REFERENCES leads(id),
      performed_by    UUID NOT NULL REFERENCES users(id),
      activity_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes           TEXT,
      outcome         TEXT,
      next_follow_up  TIMESTAMPTZ,
      follow_up_notes TEXT,
      reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title        VARCHAR(255) NOT NULL,
      description  TEXT,
      due_date     TIMESTAMPTZ,
      priority     VARCHAR(20) NOT NULL DEFAULT 'Medium',
      status       VARCHAR(20) NOT NULL DEFAULT 'To Do',
      assigned_to  UUID NOT NULL REFERENCES users(id),
      assigned_by  UUID REFERENCES users(id),
      client_id    UUID REFERENCES clients(id),
      lead_id      UUID REFERENCES leads(id),
      created_by   UUID NOT NULL REFERENCES users(id),
      completed_at TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS open_requests (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title        VARCHAR(255) NOT NULL,
      description  TEXT,
      priority     VARCHAR(20) NOT NULL DEFAULT 'Medium',
      status       VARCHAR(20) NOT NULL DEFAULT 'Open',
      client_id    UUID REFERENCES clients(id),
      submitted_by UUID NOT NULL REFERENCES users(id),
      assigned_to  UUID REFERENCES users(id),
      resolution   TEXT,
      closed_at    TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contracts (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title       VARCHAR(255) NOT NULL,
      file_url    TEXT,
      file_name   VARCHAR(255),
      file_size   INTEGER,
      start_date  DATE,
      end_date    DATE,
      notes       TEXT,
      uploaded_by UUID NOT NULL REFERENCES users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS communication_log (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id  UUID REFERENCES clients(id),
      lead_id    UUID REFERENCES leads(id),
      user_id    UUID NOT NULL REFERENCES users(id),
      direction  VARCHAR(20) NOT NULL DEFAULT 'Outbound',
      channel    VARCHAR(20) NOT NULL DEFAULT 'Email',
      subject    VARCHAR(255),
      body       TEXT,
      metadata   JSONB DEFAULT '{}',
      logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       VARCHAR(50) NOT NULL,
      title      VARCHAR(255) NOT NULL,
      body       TEXT,
      link       VARCHAR(500),
      is_read    BOOLEAN NOT NULL DEFAULT FALSE,
      metadata   JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Add tenant_id to all business tables
  const businessTables = [
    'leads','clients','activities','tasks','open_requests','request_replies',
    'quotations','quotation_charges','quotation_versions',
    'invoices','invoice_charges',
    'shipments','shipment_attachments',
    'notifications','audit_log',
    'shipping_rates','bank_accounts',
    'sales_invoices','bl_documents',
    'email_logs','contracts',
  ];
  for (const tbl of businessTables) {
    await pool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id)`);
    await pool.query(`UPDATE ${tbl} SET tenant_id='00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL`);
  }

  // Fix app_settings for multi-tenant (drop single-row constraint, add tenant_id)
  await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id)`);
  await pool.query(`ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_single_row`);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='app_settings' AND indexname='app_settings_tenant_id_key') THEN
        CREATE UNIQUE INDEX app_settings_tenant_id_key ON app_settings (tenant_id);
      END IF;
    END $$
  `);
  // Migrate legacy row 1 to tenant zero
  await pool.query(`
    UPDATE app_settings SET tenant_id='00000000-0000-0000-0000-000000000001'
    WHERE id=1 AND tenant_id IS NULL
  `);

  // Composite tenant indexes for query performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_tenant       ON leads (tenant_id) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_tenant     ON clients (tenant_id) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipments_tenant   ON shipments (tenant_id) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_invoices_tenant    ON invoices (tenant_id) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotations_tenant  ON quotations (tenant_id) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activities_tenant  ON activities (tenant_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_tenant       ON tasks (tenant_id) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant       ON users (tenant_id) WHERE deleted_at IS NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_tenant       ON audit_log (tenant_id, created_at DESC)`);

  console.log('FreightOS multi-tenant migration complete.');

  // Run demo seed after all migrations (only on fresh DB)
  if (isNewDb) {
    console.log('Seeding demo data...');
    const demoSeed = fs.readFileSync(path.join(__dirname, '../database/demo-seed.sql'), 'utf8');
    await pool.query(demoSeed);
    console.log('Demo seed complete.');
  }
}

const app = express();

app.set('trust proxy', 1);

// Ensure upload dir exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Security & parsing
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'frame-ancestors': ["'self'"],
      'frame-src': ["'self'", 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Rate limiters
// HIGH-4: Tight limits on registration and invite-accept to prevent brute force / abuse
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts' }));
app.use('/api/auth/register-company', rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many registration attempts' }));
app.use('/api/auth/accept-invite', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many invite attempts' }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300 }));

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), uploadDir)));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/bank-accounts', require('./routes/bankAccounts'));
app.use('/api/shipping-rates', require('./routes/shippingRates'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search', require('./routes/search'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/shipments/:shipmentId/attachments', require('./routes/shipmentAttachments'));
app.use('/api/bl', require('./routes/bl'));
app.use('/api/sales-invoices', require('./routes/salesInvoices'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/tenant', require('./routes/tenant'));
app.use('/api/admin', require('./routes/admin'));

// Serve built frontend for all non-API routes
const frontendBuild = path.join(__dirname, '../frontend/build');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => res.sendFile(path.join(frontendBuild, 'index.html')));
}

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use(errorHandler);

// Scheduled jobs
cron.schedule('0 8 * * *', () => {
  checkDueFollowUps();
  checkOverdueInvoices();
  warnExpiringTrials();
});

// HIGH-3: Fail fast if JWT secrets are missing or too short.
// Must run before autoMigrate so the process never starts in an insecure state.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters');
  process.exit(1);
}
if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
  console.error('FATAL: JWT_REFRESH_SECRET must be set and at least 32 characters');
  process.exit(1);
}

const PORT = process.env.PORT || 4000;
autoMigrate()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`FreightOS running on http://0.0.0.0:${PORT}`);
      console.log(`Local network access: http://YOUR_IP:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed, aborting startup:', err.message);
    process.exit(1);
  });

module.exports = app;
