const PDFDocument = require('pdfkit');
const path  = require('path');
const fs    = require('fs');
const http  = require('http');
const https = require('https');

const FONT_REGULAR = path.join(__dirname, '../../assets/LiberationSans-Regular.ttf');
const FONT_BOLD    = path.join(__dirname, '../../assets/LiberationSans-Bold.ttf');

const COMPANY_DEFAULTS = {
  name:    'ABC Logistics',
  tagline: 'Delivering Your Success',
  address: '6 Abdelfattah Yahia St - Raml Station, Alexandria, Egypt',
  email:   'sales@abclogistics.com  |  pricing@abclogistics.com',
  phone:   '+20 111 8 111 463  |  +20 111 74 35 782',
  logoUrl: process.env.COMPANY_LOGO || 'https://www.abclogistics.com/SubmarkLogo.png',
  logoFile: path.join(__dirname, '../../assets/logo.png'),
};

const companyFrom = (s) => ({
  ...COMPANY_DEFAULTS,
  ...(s?.company?.name    ? { name:    s.company.name }    : {}),
  ...(s?.company?.address ? { address: s.company.address } : {}),
  ...(s?.company?.email   ? { email:   s.company.email }   : {}),
  ...(s?.company?.phone   ? { phone:   s.company.phone }   : {}),
});

const TERMS = [
  { title: 'Validity & Changes:',            body: 'Quote is subject to immediate change based on carrier space/equipment availability, GRI, or market fluctuations at the time of booking.' },
  { title: 'Standard Cargo Basis:',          body: 'Rates assume non-hazardous, stackable, and standard commercial cargo unless explicitly noted. Hazardous (HAZMAT), perishable, or oversized goods will incur heavy surcharges.' },
  { title: 'Fluctuating Surcharges:',        body: 'All shipments are subject to Fuel (FSC/BAF) and Currency (CAF) adjustments applicable at the exact date of departure.' },
  { title: 'Payment Terms:',                 body: 'Payment is due before release, unless agreed otherwise.' },
  { title: 'Chargeable Weight & Volume:',    body: 'Final billing is based on actual carrier weights/measurements. The shipper is fully responsible for any discrepancies from the original quote request.' },
  { title: 'Standard Exclusions:',           body: 'Unless specifically itemized as "Included," this quote excludes: customs duties/taxes, government inspections (X-ray, physical exams), storage, demurrage, and detention.' },
  { title: 'Limited Liability & Insurance:', body: 'Standard carrier liability is strictly limited by international conventions (e.g., COGSA, Montreal Convention) and rarely covers full cargo value. Cargo is not insured unless comprehensive insurance is requested in writing and paid for in advance.' },
  { title: 'Cancellations:',                 body: 'Cancellations or booking modifications made within 48 hours of scheduled pickup are subject to cancellation or "dead freight" fees.' },
];

const ORANGE = '#1e40af';
const WHITE  = '#FFFFFF';
const DARK   = '#1C1C1C';
const MID    = '#555555';
const LIGHT  = '#999999';
const BLUE   = '#1e3a8a';
const OFF    = '#F8F8F6';
const RULE   = '#DEDEDE';

const W      = 595;
const MARGIN = 50;
const CW     = W - MARGIN * 2;
const HDR_H  = 105;
const FOOT_Y = 800;

const getLogo = async (COMPANY) => {
  if (fs.existsSync(COMPANY.logoFile)) return fs.readFileSync(COMPANY.logoFile);
  return new Promise(resolve => {
    const client = COMPANY.logoUrl.startsWith('https') ? https : http;
    client.get(COMPANY.logoUrl, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null));
  });
};

exports.generateSalesInvoicePdf = async (inv, settings = {}) => {
  const COMPANY = companyFrom(settings);
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Sales Invoice ${inv.invoice_no}` } });
  doc.registerFont('Body', FONT_REGULAR);
  doc.registerFont('Body-Bold', FONT_BOLD);

  const buffers = [];
  doc.on('data', b => buffers.push(b));

  return new Promise(async (resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    const logoBuffer = await getLogo(COMPANY);

    // ── HEADER ───────────────────────────────────────────────────────────────
    doc.rect(0, 0, 230, HDR_H).fill(WHITE);
    doc.rect(230, 0, W - 230, HDR_H).fill(ORANGE);
    doc.rect(0, HDR_H, W, 3).fill(ORANGE);

    if (logoBuffer) {
      try { doc.image(logoBuffer, MARGIN, 16, { height: 70, fit: [130, 70] }); } catch (_) {}
    }
    const infoX = 242;
    doc.fillColor(WHITE).font('Body-Bold').fontSize(12).text(COMPANY.name, infoX, 18, { width: W - infoX - 20 });
    doc.font('Body').fontSize(8).fillColor('rgba(255,255,255,0.82)');
    doc.text(COMPANY.tagline, infoX, 34, { width: W - infoX - 20 });
    doc.text(COMPANY.address, infoX, 46, { width: W - infoX - 20 });
    doc.text(COMPANY.email,   infoX, 63, { width: W - infoX - 20 });
    doc.text(COMPANY.phone,   infoX, 75, { width: W - infoX - 20 });

    // ── CONTENT SETUP ─────────────────────────────────────────────────────────
    let y = HDR_H + 20;
    const rule = (ry, color = RULE) => {
      doc.moveTo(MARGIN, ry).lineTo(MARGIN + CW, ry).strokeColor(color).lineWidth(0.5).stroke();
    };
    const sectionLabel = (label, ly) => {
      rule(ly);
      doc.rect(MARGIN, ly + 1, 3, 14).fill(ORANGE);
      doc.fillColor(DARK).font('Body-Bold').fontSize(8.5)
         .text(label.toUpperCase(), MARGIN + 9, ly + 4, { characterSpacing: 0.8 });
      return ly + 18;
    };

    // ── TITLE + INVOICE NO ────────────────────────────────────────────────────
    doc.fillColor(DARK).font('Body-Bold').fontSize(22)
       .text('SALES INVOICE', MARGIN, y);

    // Reference box (top right)
    const refX = MARGIN + CW * 0.6;
    const refW = CW * 0.4;
    doc.rect(refX, y, refW, 70).stroke(RULE);
    doc.fillColor(LIGHT).font('Body').fontSize(7.5)
       .text('INVOICE NO.', refX + 10, y + 8, { characterSpacing: 0.5 });
    doc.fillColor(ORANGE).font('Body-Bold').fontSize(14)
       .text(inv.custom_invoice_no || inv.invoice_no, refX + 10, y + 20);
    doc.fillColor(MID).font('Body').fontSize(8)
       .text(`Date:  ${new Date(inv.created_at).toLocaleDateString('en-GB')}`, refX + 10, y + 43);
    if (inv.vessel_validity) {
      doc.text(`Vessel Validity:  ${new Date(inv.vessel_validity).toLocaleDateString('en-GB')}`, refX + 10, y + 57);
    }

    y += 80;

    // ── CLIENT ────────────────────────────────────────────────────────────────
    y = sectionLabel('Prepared For', y);
    y += 4;
    doc.fillColor(DARK).font('Body-Bold').fontSize(13)
       .text(inv.client_name || inv.client_display || 'N/A', MARGIN, y);
    y += doc.heightOfString(inv.client_name || inv.client_display || 'N/A', { width: CW }) + 2;
    if (inv.client_address || inv.client_address_full) {
      doc.fillColor(MID).font('Body').fontSize(9)
         .text(inv.client_address || inv.client_address_full, MARGIN, y, { width: CW });
      y += doc.heightOfString(inv.client_address || inv.client_address_full, { width: CW }) + 2;
    }
    y += 12;

    // ── ADDRESS ──────────────────────────────────────────────────────────────
    if (inv.shipment_details) {
      y = sectionLabel('Address', y);
      y += 4;
      doc.fillColor(DARK).font('Body').fontSize(9)
         .text(inv.shipment_details, MARGIN, y, { width: CW });
      y += doc.heightOfString(inv.shipment_details, { width: CW }) + 8;
    }

    // ── POL / POD / CONTAINER TYPE ────────────────────────────────────────────
    const hasRoute = inv.pol || inv.pod || inv.container_type;
    if (hasRoute) {
      if (!inv.shipment_details) { y = sectionLabel('Shipment Info', y); y += 4; }
      const col3W = CW / 3;
      const fields = [
        ['Port of Loading (POL)', inv.pol],
        ['Port of Discharge (POD)', inv.pod],
        ['Container Type', inv.container_type],
      ];
      fields.forEach(([label, val], i) => {
        if (!val) return;
        const fx = MARGIN + i * col3W;
        doc.fillColor(LIGHT).font('Body').fontSize(7.5)
           .text(label.toUpperCase(), fx, y, { width: col3W - 8, characterSpacing: 0.4 });
        doc.fillColor(DARK).font('Body-Bold').fontSize(9.5)
           .text(val, fx, y + 12, { width: col3W - 8 });
      });
      y += 32;
    }

    // ── PRODUCT TABLE ─────────────────────────────────────────────────────────
    y = sectionLabel('Products', y);
    y += 6;

    // Table header
    const colW = { name: CW * 0.52, qty: CW * 0.13, unit: CW * 0.175, total: CW * 0.175 };
    const thdH = 20;
    doc.rect(MARGIN, y, CW, thdH).fill(ORANGE);
    const cols = [
      ['PRODUCT NAME', MARGIN + 8,                                colW.name - 8],
      ['QTY',          MARGIN + colW.name,                        colW.qty],
      ['UNIT PRICE',   MARGIN + colW.name + colW.qty,             colW.unit],
      ['$',            MARGIN + colW.name + colW.qty + colW.unit, colW.total],
    ];
    for (const [label, lx, lw] of cols) {
      doc.fillColor(WHITE).font('Body-Bold').fontSize(8.5)
         .text(label, lx, y + 6, { width: lw, align: label === 'QTY' || label === '$' ? 'center' : 'left' });
    }
    y += thdH;

    // Item rows
    const items = Array.isArray(inv.items) ? inv.items
      : (typeof inv.items === 'string' ? JSON.parse(inv.items) : []);

    items.forEach((item, idx) => {
      const rowH = 22;
      const bg = idx % 2 === 0 ? WHITE : OFF;
      doc.rect(MARGIN, y, CW, rowH).fill(bg);

      // Vertical rule between cols
      let cx = MARGIN + colW.name;
      for (const cw of [colW.qty, colW.unit, colW.total]) {
        doc.moveTo(cx, y).lineTo(cx, y + rowH).strokeColor(RULE).lineWidth(0.5).stroke();
        cx += cw;
      }

      const qty  = parseFloat(item.qty   || item.quantity || 0);
      const unit = parseFloat(item.unitPrice || item.unit_price || 0);
      const tot  = parseFloat(item.total || (qty * unit) || 0);
      const curr = inv.currency || 'USD';

      doc.fillColor(DARK).font('Body').fontSize(9)
         .text(item.name || item.description || '', MARGIN + 8, y + 6, { width: colW.name - 12 });
      doc.text(String(qty || ''), MARGIN + colW.name, y + 6, { width: colW.qty, align: 'center' });
      doc.text(`${curr} ${unit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
               MARGIN + colW.name + colW.qty, y + 6, { width: colW.unit - 4, align: 'right' });
      doc.font('Body-Bold')
         .text(`${curr} ${tot.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
               MARGIN + colW.name + colW.qty + colW.unit, y + 6, { width: colW.total - 8, align: 'right' });

      y += rowH;
      rule(y);
    });

    y += 4;

    // Total row
    const totalAmt = parseFloat(inv.total_amount || 0);
    const curr = inv.currency || 'USD';
    const totRowH = 28;
    doc.rect(MARGIN, y, CW, totRowH).fill(BLUE);
    doc.fillColor(WHITE).font('Body-Bold').fontSize(10)
       .text('TOTAL', MARGIN + 10, y + 9);
    doc.fontSize(12)
       .text(`${curr} ${totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
             MARGIN + CW - 120, y + 8, { width: 110, align: 'right' });
    y += totRowH;

    // ── NOTES ────────────────────────────────────────────────────────────────
    if (inv.notes) {
      y += 14;
      y = sectionLabel('Notes', y);
      y += 4;
      doc.fillColor(MID).font('Body').fontSize(8.5)
         .text(inv.notes, MARGIN, y, { width: CW, lineGap: 2.5 });
      y += doc.heightOfString(inv.notes, { width: CW, lineGap: 2.5 }) + 4;
    }

    // ── REPRESENTATIVE ───────────────────────────────────────────────────────
    if (inv.rep_name) {
      y += 14;
      y = sectionLabel('Your Representative', y);
      y += 6;
      doc.fillColor(DARK).font('Body-Bold').fontSize(10).text(inv.rep_name, MARGIN, y);
      y += doc.heightOfString(inv.rep_name, { width: CW }) + 2;
      if (inv.rep_email) {
        doc.fillColor(MID).font('Body').fontSize(8.5).text(inv.rep_email, MARGIN, y);
        y += 13;
      }
      if (inv.rep_phone) {
        doc.fillColor(MID).font('Body').fontSize(8.5).text(inv.rep_phone, MARGIN, y);
        y += 13;
      }
      y += 4;
    }

    // ── TERMS & CONDITIONS ───────────────────────────────────────────────────
    y += 14;
    y = sectionLabel('Terms & Conditions', y);
    y += 4;

    const HALF     = Math.ceil(TERMS.length / 2);
    const termColW = (CW - 14) / 2;
    const colXL    = MARGIN;
    const colXR    = MARGIN + termColW + 14;
    let yL = y, yR = y;

    TERMS.forEach((term, i) => {
      const cx  = i < HALF ? colXL : colXR;
      const isL = i < HALF;
      let cy    = isL ? yL : yR;

      doc.fillColor(ORANGE).font('Body-Bold').fontSize(6.8);
      doc.text(term.title, cx, cy, { width: termColW });
      cy += doc.heightOfString(term.title, { width: termColW }) + 1;

      doc.fillColor(MID).font('Body').fontSize(6.4);
      doc.text(term.body, cx, cy, { width: termColW, lineGap: 0.8 });
      cy += doc.heightOfString(term.body, { width: termColW, lineGap: 0.8 }) + 7;

      if (isL) yL = cy; else yR = cy;
    });

    y = Math.max(yL, yR) + 8;

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footY = Math.max(y + 20, FOOT_Y);
    rule(footY, ORANGE);
    doc.rect(0, footY + 1, W, 28).fill(ORANGE);
    doc.fillColor(WHITE).font('Body-Bold').fontSize(9)
       .text(`${COMPANY.name} — Delivering Your Success`, MARGIN, footY + 8, { width: CW / 2 });
    doc.font('Body').fontSize(7.5).fillColor('rgba(255,255,255,0.85)')
       .text(`${COMPANY.address}`, MARGIN, footY + 20, { width: CW * 0.55 });
    doc.text(`Generated by ABC Logistics CRM`, MARGIN + CW - 120, footY + 14, { width: 120, align: 'right' });

    doc.end();
  });
};
