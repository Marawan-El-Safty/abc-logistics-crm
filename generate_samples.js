const fs = require('fs');
const path = require('path');
const { generateQuotationPdf } = require('./backend/src/services/pdfService');
const { generateBlPdf } = require('./backend/src/services/blPdfService');
const { generateSalesInvoicePdf } = require('./backend/src/services/salesInvoicePdfService');

const settings = {
  pdf: { primaryColor: '#1e40af', secondaryColor: '#1e3a8a' },
};

const quotation = {
  reference_no: 'QT-2026-0312',
  created_at: '2026-06-15T00:00:00Z',
  valid_until: '2026-07-15T00:00:00Z',
  client_name: 'Mediterranean Trading Co.',
  client_address: '14 Port Said St, Alexandria, Egypt',
  service_type: 'Sea Freight FCL',
  origin: 'Alexandria, Egypt',
  destination: 'Hamburg, Germany',
  cargo_type: '1 x 40\' HC Container',
  weight: '18500',
  volume: '67.5',
  transit_time: '18–22 Days',
  free_days: 14,
  carrier: 'MSC Mediterranean',
  show_carrier_in_pdf: true,
  incoterms: 'FOB',
  currency: 'USD',
  notes: 'Rate valid subject to space availability at time of booking. Please confirm cargo readiness date at least 7 days before ETD.',
  charges: [
    { category: 'Ocean Freight', description: 'FCL 40\' HC – Alexandria to Hamburg', currency: 'USD', amount: 2400, unit_rate: 2400, qty: 1 },
    { category: 'Origin Charges', description: 'Port Handling & THC (Alexandria)', currency: 'USD', amount: 320, unit_rate: 320, qty: 1 },
    { category: 'Origin Charges', description: 'B/L Issuance Fee', currency: 'USD', amount: 75, unit_rate: 75, qty: 1 },
    { category: 'Destination Charges', description: 'Destination THC (Hamburg)', currency: 'USD', amount: 450, unit_rate: 450, qty: 1 },
    { category: 'Documentation', description: 'Export Customs Documentation', currency: 'USD', amount: 120, unit_rate: 120, qty: 1 },
  ],
};

const invoice = {
  invoice_no: 'INV-2026-0089',
  created_at: '2026-06-15T00:00:00Z',
  due_date: '2026-07-05T00:00:00Z',
  client_name: 'Mediterranean Trading Co.',
  client_address: '14 Port Said St, Alexandria, Egypt',
  reference: 'QT-2026-0312',
  service_type: 'Sea Freight FCL',
  origin: 'Alexandria, Egypt',
  destination: 'Hamburg, Germany',
  currency: 'USD',
  status: 'Unpaid',
  notes: 'Please transfer payment to the bank account listed below. Reference invoice number on transfer.',
  total_amount: 3365,
  items: [
    { description: 'Ocean Freight – FCL 40\' HC (Alexandria → Hamburg)', qty: 1, unit_price: 2400, total: 2400 },
    { description: 'Port Handling & THC (Alexandria)', qty: 1, unit_price: 320, total: 320 },
    { description: 'B/L Issuance Fee', qty: 1, unit_price: 75, total: 75 },
    { description: 'Destination THC (Hamburg)', qty: 1, unit_price: 450, total: 450 },
    { description: 'Export Customs Documentation', qty: 1, unit_price: 120, total: 120 },
  ],
};

const bl = {
  bl_no: 'ABCL-2026-HBG-00341',
  shipper: 'Mediterranean Trading Co.\n14 Port Said St\nAlexandria, Egypt\nTel: +20 3 123 4567',
  consignee: 'Nordsee Import GmbH\nKehrwieder 8\n20457 Hamburg, Germany\nTel: +49 40 987654',
  notify_party: 'Nordsee Import GmbH\nKehrwieder 8\n20457 Hamburg, Germany\nTel: +49 40 987654',
  also_notify: 'DHL Global Freight (DE)\nLyoner Str. 15, 60528 Frankfurt',
  pre_carriage: 'Truck',
  place_of_receipt: 'Alexandria Container Terminal',
  port_of_loading: 'Alexandria, Egypt',
  port_of_discharge: 'Hamburg, Germany',
  place_of_delivery: 'Hamburg Container Terminal CTA',
  vessel: 'MSC FANTASIA',
  voyage: 'FX621E',
  etd: '2026-06-28',
  eta: '2026-07-18',
  container_no: 'MSCU7234518',
  seal_no: 'SL-44821',
  container_type: "40' HC",
  marks_numbers: 'MED-TRADE / C/1-24 / HAMBURG / MADE IN EGYPT',
  description: 'GENERAL MERCHANDISE\nCERAMIC TILES (NON-HAZARDOUS)\n24 PALLETS – SHRINK WRAPPED\nHS CODE: 6907.21',
  gross_weight: '18,500 KGS',
  measurement: '67.500 CBM',
  no_of_packages: '24 PALLETS',
  freight_payable_at: 'Alexandria',
  freight_terms: 'PREPAID',
  place_of_issue: 'Alexandria, Egypt',
  date_of_issue: '2026-06-20',
  number_of_originals: 'THREE (3)',
  status: 'Draft',
};

async function run() {
  fs.mkdirSync('/tmp/abc-crm-samples', { recursive: true });

  console.log('Generating Quotation PDF...');
  const qBuf = await generateQuotationPdf(quotation, settings);
  fs.writeFileSync('/tmp/abc-crm-samples/quotation.pdf', qBuf);
  console.log('  → /tmp/abc-crm-samples/quotation.pdf');

  console.log('Generating Sales Invoice PDF...');
  const iBuf = await generateSalesInvoicePdf(invoice, settings);
  fs.writeFileSync('/tmp/abc-crm-samples/invoice.pdf', iBuf);
  console.log('  → /tmp/abc-crm-samples/invoice.pdf');

  console.log('Generating Bill of Lading PDF...');
  const bBuf = await generateBlPdf(bl, settings);
  fs.writeFileSync('/tmp/abc-crm-samples/bill_of_lading.pdf', bBuf);
  console.log('  → /tmp/abc-crm-samples/bill_of_lading.pdf');

  console.log('Done!');
}

run().catch(console.error);
