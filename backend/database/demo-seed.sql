-- Demo seed for ABC Logistics CRM
-- Run after schema migration

-- Roles (may already exist from migration)
INSERT INTO roles (name, description, permissions) VALUES
  ('Admin', 'Full access', '{"clients":["create","read","update","delete"],"leads":["create","read","update","delete"],"quotations":["create","read","update","delete"],"invoices":["create","read","update","delete"],"reports":["read"],"users":["create","read","update","delete"]}'),
  ('Sales Manager', 'Manage sales team', '{"clients":["create","read","update","delete"],"leads":["create","read","update","delete"],"quotations":["create","read","update","delete"],"invoices":["read"],"reports":["read"]}'),
  ('Sales Rep', 'Sales representative', '{"clients":["create","read","update"],"leads":["create","read","update"],"quotations":["create","read","update"],"invoices":["read"]}'),
  ('Finance', 'Finance access', '{"invoices":["create","read","update","delete"],"clients":["read"],"quotations":["read"],"reports":["read"]}'),
  ('Operation', 'Operations team', '{"quotations":["create","read","update"],"clients":["read","create","update"],"shipping_rates":["read"]}')
ON CONFLICT (name) DO NOTHING;

-- Demo users
INSERT INTO users (full_name, email, password_hash, role_id, phone, job_title, is_active)
SELECT
  'Admin User', 'admin@abclogistics.com',
  '$2b$12$OhciwRPo0ft8j7Oh/uuS4eFz025HOp8fuOU0fmTgYx3qWXAWng.Ge',
  r.id, '+1 555 000 0001', 'System Administrator', TRUE
FROM roles r WHERE r.name = 'Admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (full_name, email, password_hash, role_id, phone, job_title, is_active)
SELECT
  'Sarah Mitchell', 'sarah@abclogistics.com',
  '$2b$12$OhciwRPo0ft8j7Oh/uuS4eFz025HOp8fuOU0fmTgYx3qWXAWng.Ge',
  r.id, '+1 555 000 0002', 'Sales Manager', TRUE
FROM roles r WHERE r.name = 'Sales Manager'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (full_name, email, password_hash, role_id, phone, job_title, is_active)
SELECT
  'James Carter', 'james@abclogistics.com',
  '$2b$12$OhciwRPo0ft8j7Oh/uuS4eFz025HOp8fuOU0fmTgYx3qWXAWng.Ge',
  r.id, '+1 555 000 0003', 'Sales Representative', TRUE
FROM roles r WHERE r.name = 'Sales Rep'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (full_name, email, password_hash, role_id, phone, job_title, is_active)
SELECT
  'Linda Zhao', 'linda@abclogistics.com',
  '$2b$12$OhciwRPo0ft8j7Oh/uuS4eFz025HOp8fuOU0fmTgYx3qWXAWng.Ge',
  r.id, '+1 555 000 0004', 'Finance Officer', TRUE
FROM roles r WHERE r.name = 'Finance'
ON CONFLICT (email) DO NOTHING;

-- App settings (no bank details, generic company info)
INSERT INTO app_settings (id, data) VALUES (1, '{
  "company": {
    "name": "ABC Logistics",
    "tagline": "Global Freight Solutions",
    "address": "123 Harbor Street, Suite 400, Miami, FL 33101, USA",
    "email": "info@abclogistics.com",
    "phone": "+1 555 000 0000"
  },
  "defaultCurrency": "USD",
  "pdf": {
    "footerDisclaimer": "All rates are subject to change without prior notice. This document is for informational purposes only."
  },
  "session": {
    "warningMinutes": 55,
    "timeoutMinutes": 60
  }
}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;

-- Demo contacts (created_by = admin user)
INSERT INTO clients (company_name, email, phone, country, contact_type, industry, website, notes, created_by)
SELECT v.company_name, v.email, v.phone, v.country, v.contact_type::varchar, v.industry::industry_type, v.website, v.notes, u.id
FROM (VALUES
  ('GLOBAL FREIGHT PARTNERS', 'michael@globalfreight.com', '+1 305 555 1001', 'USA', 'Freight Forwarder', 'Freight Forwarder', 'www.globalfreight.com', 'Key partner on US–Europe lanes'),
  ('PACIFIC TRADE LOGISTICS', 'yuki@pacifictrade.com', '+81 3 5555 2002', 'JAPAN', 'Freight Forwarder', 'Freight Forwarder', 'www.pacifictrade.com', 'Strong network in Asia Pacific'),
  ('EURO CARGO EXPRESS', 'k.schneider@eurocargo.de', '+49 40 5555 3003', 'GERMANY', 'Client', 'Exporter', 'www.eurocargo.de', 'Regular FCL shipper on Asia–Europe'),
  ('NILE TRADING CO', 'ahmed@niletrading.eg', '+20 2 5555 4004', 'EGYPT', 'Client', 'Importer', 'www.niletrading.eg', 'Imports electronics and machinery'),
  ('ATLAS SHIPPING LINES', 'sophie@atlaslines.com', '+33 1 5555 5005', 'FRANCE', 'Carrier', 'Shipping Lines', 'www.atlaslines.com', 'Carrier for Med and North Africa routes'),
  ('SUNRISE MANUFACTURING', 'wanglei@sunrisemfg.cn', '+86 21 5555 6006', 'CHINA', 'Client', 'Manufacturer', 'www.sunrisemfg.cn', 'Large volume FCL exporter'),
  ('MEDWAY BROKERS', 'omar@medwaybrokers.ae', '+971 4 5555 7007', 'UAE', 'Freight Forwarder', 'Freight Forwarder', 'www.medwaybrokers.ae', 'UAE hub, strong Gulf connections'),
  ('COASTAL IMPORTS INC', 'david@coastalimports.com', '+1 212 5555 8008', 'USA', 'Client', 'Importer', 'www.coastalimports.com', 'Regular LCL importer'),
  ('TRANSMED LOGISTICS', 'carlos@transmed.es', '+34 93 5555 9009', 'SPAIN', 'Freight Forwarder', 'Logistics Agent', 'www.transmed.es', 'Partner in Iberian Peninsula'),
  ('BRIGHTON TRADING GROUP', 'emma@brightontrading.co.uk', '+44 20 5555 1010', 'UK', 'Client', 'Trading', 'www.brightontrading.co.uk', 'Import/export mixed cargo'),
  ('GOLDEN GATE FREIGHT', 'lisa@goldengate.com', '+1 415 5555 1111', 'USA', 'Freight Forwarder', 'Freight Forwarder', 'www.goldengate.com', 'West coast specialist'),
  ('DUBAI PORT SERVICES', 'khalid@dubaiport.ae', '+971 4 5555 1212', 'UAE', 'Supplier', 'Logistics Agent', 'www.dubaiport.ae', 'Port handling and customs clearance'),
  ('EAST AFRICA FREIGHT', 'amina@eafreight.ke', '+254 20 5555 1313', 'KENYA', 'Freight Forwarder', 'Freight Forwarder', 'www.eafreight.ke', 'East Africa network'),
  ('NORDIC CARGO AS', 'erik@nordiccargo.no', '+47 22 5555 1414', 'NORWAY', 'Client', 'Exporter', 'www.nordiccargo.no', 'Fish and seafood exports'),
  ('HORIZON SHIPPING', 'priya@horizonship.in', '+91 22 5555 1515', 'INDIA', 'Carrier', 'Shipping Lines', 'www.horizonship.in', 'South Asia carrier partner')
) AS v(company_name, email, phone, country, contact_type, industry, website, notes),
users u WHERE u.email = 'admin@abclogistics.com';

-- Demo leads
INSERT INTO leads (company_name, contact_name, email, phone, stage, source, notes, assigned_to, created_by)
SELECT 'VENTURE IMPORTS LTD', 'Robert Green', 'robert@ventureimports.com', '+1 646 555 2001',
  'Contacted'::lead_stage, 'Manual Entry'::lead_source, 'Interested in regular LCL service from China', u.id, u.id
FROM users u WHERE u.email = 'james@abclogistics.com';

INSERT INTO leads (company_name, contact_name, email, phone, stage, source, notes, assigned_to, created_by)
SELECT 'ISTANBUL TEXTILE EXPORTS', 'Mehmet Yilmaz', 'mehmet@istextile.tr', '+90 212 555 2002',
  'Proposal Sent'::lead_stage, 'Manual Entry'::lead_source, 'Looking for FCL rates on Istanbul–USA', u.id, u.id
FROM users u WHERE u.email = 'james@abclogistics.com';

INSERT INTO leads (company_name, contact_name, email, phone, stage, source, notes, assigned_to, created_by)
SELECT 'CAPE TOWN MERCHANTS', 'Sipho Dlamini', 'sipho@capetownmerch.za', '+27 21 555 2003',
  'New Lead'::lead_stage, 'Referral'::lead_source, 'Needs import customs support', u.id, u.id
FROM users u WHERE u.email = 'sarah@abclogistics.com';

-- Demo shipping rates
INSERT INTO shipping_rates (shipping_line, pol, pod, service_type, rate_20dc, rate_40dc, rate_40hc, currency, transit_time, free_days, valid_from, valid_to, created_by)
SELECT 'ATLAS SHIPPING LINES', 'SHANGHAI', 'MIAMI', 'FCL', 1800, 2800, 3000, 'USD', '28 days', 7,
  CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', u.id
FROM users u WHERE u.email = 'admin@abclogistics.com';

INSERT INTO shipping_rates (shipping_line, pol, pod, service_type, rate_20dc, rate_40dc, rate_40hc, currency, transit_time, free_days, valid_from, valid_to, created_by)
SELECT 'HORIZON SHIPPING', 'HAMBURG', 'NEW YORK', 'FCL', 1200, 2000, 2200, 'USD', '14 days', 7,
  CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', u.id
FROM users u WHERE u.email = 'admin@abclogistics.com';

INSERT INTO shipping_rates (shipping_line, pol, pod, service_type, rate_20dc, rate_40dc, rate_40hc, currency, transit_time, free_days, valid_from, valid_to, created_by)
SELECT 'ATLAS SHIPPING LINES', 'DUBAI', 'BARCELONA', 'FCL', 950, 1600, 1750, 'USD', '12 days', 5,
  CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', u.id
FROM users u WHERE u.email = 'admin@abclogistics.com';

-- Fake bank accounts for demo invoices
INSERT INTO bank_accounts (account_name, account_number, currency, iban, bank_name, bank_address, swift_code, is_active, notes)
VALUES
  ('ABC Logistics – USD Account', '1234567890', 'USD',
   'US12 ABCD 1234 5678 9012 34', 'First National Bank',
   '100 Financial Plaza, Miami, FL 33101, USA', 'FNBKUS3M', TRUE,
   'Main USD operating account'),
  ('ABC Logistics – EUR Account', '0987654321', 'EUR',
   'DE89 3704 0044 0532 0130 00', 'Deutsche Handelsbank',
   'Königsallee 45, 40212 Düsseldorf, Germany', 'DTHBDEDB', TRUE,
   'European transactions account'),
  ('ABC Logistics – EGP Account', '1122334455', 'EGP',
   'EG123456789012345678901234', 'Cairo Commercial Bank',
   '12 Corniche El Nil, Cairo, Egypt', 'CCBKEGCX', TRUE,
   'Local EGP account');
