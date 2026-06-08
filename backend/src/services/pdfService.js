const PDFDocument = require('pdfkit');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const COMPANY = {
  name: 'ABC Logistics',
  tagline: 'Delivering Your Success',
  address: '6 Abdelfattah Yahia St - Raml Station, Alexandria, Egypt',
  email: 'sales@abclogistics.com  |  pricing@abclogistics.com',
  phone: '+20 111 8 111 463  |  +20 111 74 35 782',
  logoUrl: process.env.COMPANY_LOGO || 'https://www.abclogistics.com/SubmarkLogo.png',
  logoFile: path.join(__dirname, '../../assets/logo.png'),
};

// Unicode fonts (Liberation Sans) embedded so addresses/names with non-Latin-1
// characters (Turkish ş/ğ/ı/İ, accents) render correctly. PDFKit's built-in
// Helvetica is WinAnsi-only and produces mojibake for these. Liberation Sans is
// metric-compatible with Helvetica/Arial (keeps the original layout) and, unlike
// DejaVu Sans, does not apply fi/fl ligatures that mis-render in some viewers.
const FONT_REGULAR = path.join(__dirname, '../../assets/LiberationSans-Regular.ttf');
const FONT_BOLD    = path.join(__dirname, '../../assets/LiberationSans-Bold.ttf');

// Merge admin-configured company info over the static defaults
const companyFrom = (settings) => ({
  ...COMPANY,
  ...(settings?.company?.name    ? { name:    settings.company.name }    : {}),
  ...(settings?.company?.tagline ? { tagline: settings.company.tagline } : {}),
  ...(settings?.company?.address ? { address: settings.company.address } : {}),
  ...(settings?.company?.email   ? { email:   settings.company.email }   : {}),
  ...(settings?.company?.phone   ? { phone:   settings.company.phone }   : {}),
});

// Brand palette
const ORANGE = '#1e40af';
const BLUE   = '#1e3a8a';
const WHITE  = '#FFFFFF';
const OFF    = '#F8F8F6';
const DARK   = '#1C1C1C';
const MID    = '#555555';
const LIGHT  = '#999999';
const RULE   = '#DEDEDE';

const W      = 595;
const MARGIN = 50;
const CW     = W - MARGIN * 2;   // 495
const HDR_H  = 105;
const FOOT_Y = 790;
const ROW_H  = 34;

// ── Terms & Conditions (module-level so height can be measured) ──────────────
const TERMS = [
  { title: 'Quotation Validity:',         body: 'This quotation is valid for the period stated above. Rates are subject to change due to carrier space and equipment availability, general rate increases (GRI), or market fluctuations at time of booking confirmation.' },
  { title: 'Cargo Description:',          body: 'Rates are based on the cargo details provided by the client. Any variation in commodity, weight, volume, or packaging may result in rate adjustment. Hazardous, perishable, or oversized cargo requires prior written approval and may attract additional surcharges.' },
  { title: 'Surcharges & Adjustments:',   body: 'All shipments are subject to applicable surcharges including Bunker Adjustment Factor (BAF), Currency Adjustment Factor (CAF), Peak Season Surcharge (PSS), and Emergency Rate Restoration (ERR) in effect at time of sailing.' },
  { title: 'Payment Terms:',              body: 'Payment is due as per agreed terms. ABC Logistics reserves the right to withhold release of cargo documents until full settlement of outstanding invoices. Bank charges are to be borne by the remitting party.' },
  { title: 'Scope of Service:',           body: 'Unless expressly stated, this quotation covers freight charges only. Port handling, customs duties and taxes, inspection fees, storage, demurrage, detention, and inland transportation are excluded unless specifically itemised.' },
  { title: 'Carrier Liability:',          body: 'Carrier liability is governed by applicable international conventions (Hague-Visby Rules, COGSA, Montreal Convention). ABC Logistics strongly recommends arranging comprehensive cargo insurance. We accept no liability for loss or damage beyond the carrier\'s statutory limits.' },
  { title: 'Documentation:',              body: 'The client is responsible for providing accurate and complete shipping instructions, commercial invoice, packing list, and any required certificates or permits prior to the agreed documentation cut-off. ABC Logistics is not liable for delays arising from incomplete or incorrect documentation.' },
  { title: 'Governing Law:',              body: 'This quotation and any resulting contract shall be governed by applicable international trade laws and regulations. Any dispute shall be subject to amicable resolution and, failing that, to the jurisdiction of the competent courts.' },
];

const CHARGE_ORDER = {
  'Freight': 1, 'Local Charges': 2, 'Destination Charges': 3,
  'B/L Charges': 4, 'Insurance': 5, 'Custom Clearance': 6,
  'Inland Charges': 7, 'Official Receipts': 8, 'Other': 9,
};

const fetchUrl = (url) =>
  new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null));
  });

const getLogo = async () => {
  if (fs.existsSync(COMPANY.logoFile)) return fs.readFileSync(COMPANY.logoFile);
  return fetchUrl(COMPANY.logoUrl);
};

// ── Pre-measure content height so we can auto-scale to one page ─────────────
// NOTE: This function temporarily changes doc font state — that is intentional;
// the rendering phase sets fonts explicitly before every draw call.
function calcContentHeight(quotation, doc) {
  let h = 0;
  const termColW = (CW - 14) / 2;
  const HALF = Math.ceil(TERMS.length / 2);

  // Title + reference block (fixed)
  h += 85;

  // Prepared For
  h += 12 + 18 + 2;                                   // rule + sectionLabel + gap
  doc.font('Body-Bold').fontSize(12);
  h += doc.heightOfString(quotation.client_name || 'N/A', { width: CW });
  if (quotation.client_address) {
    doc.font('Body').fontSize(9);
    h += doc.heightOfString(quotation.client_address, { width: CW }) + 3;
  }
  h += 14;                                             // bottom gap

  // Shipment Details
  h += 12 + 18 + 4;                                   // rule + label + gap
  h += 3 * ROW_H;                                     // 3 base rows
  if (quotation.carrier && quotation.show_carrier_in_pdf) h += ROW_H;
  if (quotation.incoterms || quotation.pickup_location || quotation.delivery_location) h += ROW_H;
  h += 20;                                             // gap

  // Charges
  h += 12 + 18 + 6 + 12 + 1;                          // rule+label+gap+colHeaders+rule
  (quotation.charges || []).forEach(c => {
    const qty = parseFloat(c.qty || 1);
    h += ((qty > 1) ? 36 : 24) + 1;
  });
  h += 4 + 28;                                        // gap + total row

  // Notes
  if (quotation.notes) {
    h += 18 + 12 + 18 + 2;
    doc.font('Body').fontSize(8.5);
    h += doc.heightOfString(quotation.notes, { width: CW, lineGap: 2.5 }) + 4;
  }

  // T&C
  h += 18 + 12 + 18 + 4;
  let yL = 0, yR = 0;
  TERMS.forEach((term, i) => {
    const isL = i < HALF;
    let cy = isL ? yL : yR;
    doc.font('Body-Bold').fontSize(6.8);
    cy += doc.heightOfString(term.title, { width: termColW }) + 1;
    doc.font('Body').fontSize(6.4);
    cy += doc.heightOfString(term.body, { width: termColW, lineGap: 0.8 }) + 7;
    if (isL) yL = cy; else yR = cy;
  });
  h += Math.max(yL, yR);

  return h;
}

exports.generateQuotationPdf = async (quotation, settings = {}) => {
  const COMPANY = companyFrom(settings);   // shadows module default with admin config
  const doc = new PDFDocument({
    size: 'A4', margin: 0,
    info: { Title: `Quotation ${quotation.reference_no}`, Author: COMPANY.name },
  });
  // Register Unicode fonts under the same alias names used throughout, so all
  // text (incl. measurement in calcContentHeight) uses a font that supports
  // the full Latin/Turkish/Cyrillic range instead of WinAnsi-only Helvetica.
  doc.registerFont('Body', FONT_REGULAR);
  doc.registerFont('Body-Bold', FONT_BOLD);

  const buffers = [];
  doc.on('data', (b) => buffers.push(b));

  return new Promise(async (resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // ── HEADER (always full-size, never scaled) ──────────────────────────────
    doc.rect(0, 0, 230, HDR_H).fill(WHITE);
    doc.rect(230, 0, W - 230, HDR_H).fill(ORANGE);
    doc.rect(0, HDR_H, W, 3).fill(ORANGE);

    const logoBuffer = await getLogo();
    if (logoBuffer) {
      try { doc.image(logoBuffer, MARGIN, 16, { height: 70, fit: [130, 70] }); }
      catch (_) {}
    }

    const infoX = 242;
    doc.fillColor(WHITE).font('Body-Bold').fontSize(12);
    doc.text(COMPANY.name, infoX, 18, { width: W - infoX - 20 });
    doc.font('Body').fontSize(8).fillColor('rgba(255,255,255,0.82)');
    doc.text(COMPANY.tagline, infoX, 34, { width: W - infoX - 20 });
    doc.text(COMPANY.address, infoX, 46, { width: W - infoX - 20 });
    doc.text(COMPANY.email,   infoX, 63, { width: W - infoX - 20 });
    doc.text(COMPANY.phone,   infoX, 75, { width: W - infoX - 20 });

    // ── SCALING SETUP ────────────────────────────────────────────────────────
    // Measure content height, compute a uniform scale factor so everything
    // fits between the header and the footer in one page.
    // We use MANUAL coordinate helpers (SY / SH / SF) instead of
    // doc.save() + doc.transform() + doc.restore() — that approach corrupts
    // PDFKit's internal y-flip state and causes the footer to render upside down.

    const CONTENT_START_Y = HDR_H + 20;         // 125 pt from top
    const AVAILABLE_H     = FOOT_Y - CONTENT_START_Y;  // 665 pt available
    const contentH        = calcContentHeight(quotation, doc);
    const scale           = Math.min(1.0, AVAILABLE_H / contentH);

    // SY  — convert a raw-coordinate y into the scaled page y
    // SH  — scale a height / vertical offset
    // SF  — scale a font size (floor at 4 pt so text stays legible)
    const SY = (rawY) => CONTENT_START_Y + (rawY - CONTENT_START_Y) * scale;
    const SH = (h)    => h * scale;
    const SF = (f)    => Math.max(4, f * scale);

    // ── Scaled drawing helpers ───────────────────────────────────────────────
    // ruleS / sectionLabelS take RAW y coordinates and apply SY internally.

    const ruleS = (rawY, x = MARGIN, w = CW, color = RULE) => {
      doc.rect(x, SY(rawY), w, Math.max(0.5, SH(0.5))).fill(color);
    };

    // Returns the next raw y (caller advances by 18 in raw space).
    const sectionLabelS = (label, rawY) => {
      doc.rect(MARGIN, SY(rawY), 3, SH(11)).fill(ORANGE);
      doc.fillColor(DARK).font('Body-Bold').fontSize(SF(8.5));
      doc.text(label.toUpperCase(), MARGIN + 9, SY(rawY), { characterSpacing: 0.8 });
      return rawY + 18;
    };

    // ── TITLE + REFERENCE ────────────────────────────────────────────────────
    let y = CONTENT_START_Y;

    doc.fillColor(DARK).font('Body-Bold').fontSize(SF(21));
    doc.text('FREIGHT QUOTATION', MARGIN, SY(y));

    const refX = 360, refY = y - 2, refW = 185, refH = 72;
    doc.rect(refX, SY(refY), refW, SH(refH)).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.rect(refX, SY(refY), refW, SH(2.5)).fill(ORANGE);

    doc.fillColor(LIGHT).font('Body').fontSize(SF(7.5));
    doc.text('REFERENCE NO.', refX + 10, SY(refY + 8));
    doc.fillColor(ORANGE).font('Body-Bold').fontSize(SF(16));
    doc.text(quotation.reference_no, refX + 10, SY(refY + 20));
    doc.fillColor(MID).font('Body').fontSize(SF(8));
    doc.text('Date:  ' + new Date(quotation.created_at).toLocaleDateString('en-GB'), refX + 10, SY(refY + 43));
    if (quotation.valid_until) {
      doc.text('Valid until:  ' + new Date(quotation.valid_until).toLocaleDateString('en-GB'), refX + 10, SY(refY + 55));
    }

    y += 85;

    // ── PREPARED FOR ─────────────────────────────────────────────────────────
    ruleS(y); y += 12;
    y = sectionLabelS('Prepared For', y);
    y += 2;

    doc.fillColor(DARK).font('Body-Bold').fontSize(SF(12));
    doc.text(quotation.client_name || 'N/A', MARGIN, SY(y));
    // heightOfString uses the current font (SF(12)); divide by scale to get raw advance
    y += doc.heightOfString(quotation.client_name || 'N/A', { width: CW }) / scale;

    if (quotation.client_address) {
      doc.fillColor(MID).font('Body').fontSize(SF(9));
      doc.text(quotation.client_address, MARGIN, SY(y));
      y += doc.heightOfString(quotation.client_address, { width: CW }) / scale + 3;
    }
    y += 14;

    // ── SHIPMENT DETAILS ─────────────────────────────────────────────────────
    ruleS(y); y += 12;
    y = sectionLabelS('Shipment Details', y);
    y += 4;

    const cols = [MARGIN, MARGIN + CW / 3, MARGIN + (CW / 3) * 2];
    const colW = CW / 3 - 10;

    // detailCellS: cx/cy are in raw coordinates; function applies SY internally
    const detailCellS = (label, value, cx, rawCy) => {
      doc.fillColor(ORANGE).font('Body-Bold').fontSize(SF(7))
        .text(label.toUpperCase(), cx, SY(rawCy), { width: colW, characterSpacing: 0.5 });
      doc.fillColor(DARK).font('Body').fontSize(SF(9.5))
        .text(value || '—', cx, SY(rawCy + 11), { width: colW });
    };

    doc.rect(MARGIN, SY(y), CW, SH(ROW_H)).fill(OFF);
    detailCellS('Service Type', quotation.service_type, cols[0], y + 6);
    detailCellS('Origin',       quotation.origin,       cols[1], y + 6);
    detailCellS('Destination',  quotation.destination,  cols[2], y + 6);
    ruleS(y + ROW_H); y += ROW_H;

    doc.rect(MARGIN, SY(y), CW, SH(ROW_H)).fill(WHITE);
    detailCellS('Cargo Type', quotation.cargo_type, cols[0], y + 6);
    detailCellS('Weight', quotation.weight ? quotation.weight + ' kg' : null, cols[1], y + 6);
    detailCellS('Volume', quotation.volume ? quotation.volume + ' CBM' : null, cols[2], y + 6);
    ruleS(y + ROW_H); y += ROW_H;

    doc.rect(MARGIN, SY(y), CW, SH(ROW_H)).fill(OFF);
    detailCellS('Transit Time', quotation.transit_time, cols[0], y + 6);
    detailCellS('Free Days (Demurrage)', quotation.free_days != null ? String(quotation.free_days) : null, cols[1], y + 6);
    ruleS(y + ROW_H); y += ROW_H;

    if (quotation.carrier && quotation.show_carrier_in_pdf) {
      doc.rect(MARGIN, SY(y), CW, SH(ROW_H)).fill(WHITE);
      detailCellS('Carrier', quotation.carrier, cols[0], y + 6);
      ruleS(y + ROW_H); y += ROW_H;
    }

    if (quotation.incoterms || quotation.pickup_location || quotation.delivery_location) {
      const incotermDisplay = quotation.incoterms === 'Others'
        ? (quotation.incoterm_other || 'Others')
        : quotation.incoterms;
      doc.rect(MARGIN, SY(y), CW, SH(ROW_H)).fill(WHITE);
      detailCellS('Incoterms', incotermDisplay, cols[0], y + 6);
      if (quotation.pickup_location) {
        detailCellS('Pickup Location', quotation.pickup_location, cols[1], y + 6);
      }
      if (quotation.delivery_location) {
        detailCellS('Delivery Location', quotation.delivery_location, cols[2], y + 6);
      }
      ruleS(y + ROW_H); y += ROW_H;
    }

    y += 20;

    // ── CHARGES TABLE ────────────────────────────────────────────────────────
    ruleS(y); y += 12;
    y = sectionLabelS('Charges', y);
    y += 6;

    // Charge table columns: Category | Description | Unit Price | Total Price
    const catX  = MARGIN,           catW  = 95;
    const descX = MARGIN + 100,     descW = 165;
    const unitX = MARGIN + 270,     unitW = 80;
    const totX  = MARGIN + CW - 90, totW  = 90;

    doc.fillColor(LIGHT).font('Body-Bold').fontSize(SF(7.5));
    doc.text('CATEGORY',    catX,  SY(y), { width: catW,  characterSpacing: 0.5 });
    doc.text('DESCRIPTION', descX, SY(y), { width: descW, characterSpacing: 0.5 });
    doc.text('UNIT PRICE',  unitX, SY(y), { width: unitW, align: 'right', characterSpacing: 0.5 });
    doc.text('TOTAL PRICE', totX,  SY(y), { width: totW,  align: 'right', characterSpacing: 0.5 });
    y += 12;
    ruleS(y, MARGIN, CW, ORANGE); y += 1;

    const sortedCharges = [...(quotation.charges || [])].sort(
      (a, b) => (CHARGE_ORDER[a.category] || 99) - (CHARGE_ORDER[b.category] || 99)
    );

    let grandTotal = 0;
    sortedCharges.forEach((charge, idx) => {
      const rowY = y;
      const qty      = parseFloat(charge.qty) || 1;
      const unitRate = parseFloat(charge.unit_rate || charge.unitRate) || 0;
      const hasBreakdown = qty > 1;
      const rowH = hasBreakdown ? 36 : 24;
      const bg   = idx % 2 === 0 ? WHITE : OFF;

      doc.rect(MARGIN, SY(rowY), CW, SH(rowH)).fill(bg);

      const curr = charge.currency || quotation.currency;
      const amt  = parseFloat(charge.amount || 0);
      grandTotal += amt;
      // Unit price: explicit unit_rate when set, otherwise derive from total/qty
      const unit = unitRate > 0 ? unitRate : (qty > 0 ? amt / qty : amt);

      // Category
      doc.fillColor(MID).font('Body').fontSize(SF(8.5));
      doc.text(charge.category || '', catX, SY(rowY + 6), { width: catW });

      // Description (+ quantity hint when more than one unit)
      doc.fillColor(DARK).font('Body').fontSize(SF(9));
      doc.text(charge.description || '', descX, SY(rowY + 6), { width: descW });
      if (hasBreakdown) {
        doc.fillColor(LIGHT).font('Body').fontSize(SF(7));
        doc.text(`Qty: ${qty}`, descX, SY(rowY + 20), { width: descW });
      }

      // Unit price
      doc.fillColor(MID).font('Body').fontSize(SF(9));
      doc.text(
        `${curr} ${unit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        unitX, SY(rowY + 6), { width: unitW, align: 'right' }
      );

      // Total price
      doc.fillColor(DARK).font('Body-Bold').fontSize(SF(9));
      doc.text(
        `${curr} ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        totX, SY(rowY + 6), { width: totW, align: 'right' }
      );

      y += rowH;
      ruleS(y);
    });

    y += 4;
    doc.rect(MARGIN, SY(y), CW, SH(28)).fill(BLUE);
    doc.fillColor(WHITE).font('Body-Bold').fontSize(SF(10));
    doc.text('TOTAL', MARGIN + 10, SY(y + 9));
    doc.fillColor(WHITE).fontSize(SF(12));
    doc.text(
      `${quotation.currency} ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      MARGIN + CW - 90, SY(y + 8), { width: 90, align: 'right' }
    );
    y += 28;

    // ── NOTES ────────────────────────────────────────────────────────────────
    if (quotation.notes) {
      y += 18;
      ruleS(y); y += 12;
      y = sectionLabelS('Notes', y);
      y += 2;
      doc.fillColor(MID).font('Body').fontSize(SF(8.5));
      doc.text(quotation.notes, MARGIN, SY(y), { width: CW, lineGap: 2.5 });
      y += doc.heightOfString(quotation.notes, { width: CW, lineGap: 2.5 }) / scale + 4;
    }

    // ── TERMS & CONDITIONS ───────────────────────────────────────────────────
    y += 18;
    ruleS(y); y += 12;
    y = sectionLabelS('Terms & Conditions', y);
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

      doc.fillColor(ORANGE).font('Body-Bold').fontSize(SF(6.8));
      doc.text(term.title, cx, SY(cy), { width: termColW });
      cy += doc.heightOfString(term.title, { width: termColW }) / scale + 1;

      doc.fillColor(MID).font('Body').fontSize(SF(6.4));
      doc.text(term.body, cx, SY(cy), { width: termColW, lineGap: 0.8 });
      cy += doc.heightOfString(term.body, { width: termColW, lineGap: 0.8 }) / scale + 7;

      if (isL) yL = cy; else yR = cy;
    });

    // ── FOOTER (always anchored to bottom, no scaling applied) ───────────────
    // No doc.restore() needed — we never called doc.save() / doc.transform(),
    // so PDFKit's coordinate system is clean and the footer renders correctly.
    doc.rect(0, FOOT_Y, W, 52).fill(BLUE);
    doc.rect(0, FOOT_Y, W, 2.5).fill(ORANGE);

    doc.fillColor(WHITE).font('Body-Bold').fontSize(8.5);
    doc.text(COMPANY.name + '  —  ' + COMPANY.tagline, MARGIN, FOOT_Y + 11);

    doc.fillColor('rgba(255,255,255,0.7)').font('Body').fontSize(7.5);
    doc.text(COMPANY.address, MARGIN, FOOT_Y + 25);
    doc.text(COMPANY.email + '   |   ' + COMPANY.phone, MARGIN, FOOT_Y + 37);

    doc.fillColor('rgba(255,255,255,0.4)').fontSize(7);
    doc.text('Generated by ABC Logistics CRM', W - MARGIN - 130, FOOT_Y + 37,
      { width: 130, align: 'right' });

    doc.end();
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE PDF — replicates the Excel invoice template used by the finance team
// ─────────────────────────────────────────────────────────────────────────────
exports.generateInvoicePdf = async (invoice, settings = {}) => {
  const COMPANY = companyFrom(settings);   // shadows module default with admin config
  const doc = new PDFDocument({
    size: 'A4', margin: 0,
    info: { Title: `Invoice ${invoice.invoice_no}`, Author: COMPANY.name },
  });
  // Same Unicode fonts as the quotation PDF (see note above) so invoice
  // client names / addresses with non-Latin-1 characters render correctly.
  doc.registerFont('Body', FONT_REGULAR);
  doc.registerFont('Body-Bold', FONT_BOLD);

  const buffers = [];
  doc.on('data', b => buffers.push(b));

  return new Promise(async (resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    const PW = 595, PH = 842;
    const ML = 40, MR = 555;
    const CW_I = MR - ML;            // 515

    // Bank details — dynamic if a bank account is linked, fallback to company default
    const ba = invoice.bank_account;
    const BANK = ba ? [
      `ACCOUNT NAME :  ${ba.account_name}`,
      ba.account_number ? `ACCOUNT No.:  ${ba.account_number}${ba.currency ? ` ( ${ba.currency} )` : ''}` : null,
      ``,
      ba.iban        ? `IBAN:  ${ba.iban}`               : null,
      ba.bank_name   ? `BANK NAME :  ${ba.bank_name}`    : null,
      ba.bank_address? `ADD.:  ${ba.bank_address}`       : null,
      ba.swift_code  ? `SWIFT CODE :  ${ba.swift_code}`  : null,
    ].filter(l => l !== null) : (() => {
      // Default bank block from admin settings (falls back to company default)
      const b = settings?.pdf?.bank || {};
      return [
        `ACCOUNT NAME :  ${b.accountName || 'EL ABC Logistics.'}`,
        `ACCOUNT No.:  ${b.accountNumber || '1033338610010301'} ( ${b.currency || 'EUR'} )`,
        ``,
        `IBAN:  ${b.iban || 'EG550057000201033338610010301'}`,
        `BANK NAME :  ${b.bankName || 'ARAB AFRICAN INTERNATIONAL BANK'}`,
        `ADD.:  ${b.bankAddress || 'HORREYA ROAD BRANCH - ALEXANDRIA - EGYPT'}`,
        `SWIFT CODE :  ${b.swiftCode || 'ARAIEGCX'}`,
      ];
    })();

    const DISCLAIMER = settings?.pdf?.footerDisclaimer ||
      'THIS STATEMENT IS CONSIDERED APPROVED UNLESS YOUR OBJECTIONS REACH US ' +
      'WITH ONE WEEK AND NOT EXPOSED TO THE  TAX DEDUCT';

    // ── Orange top accent bar ─────────────────────────────────────────────────
    doc.rect(0, 0, PW, 5).fill(ORANGE);

    // ── Logo (top-right) ─────────────────────────────────────────────────────
    const logoBuffer = await getLogo();
    if (logoBuffer) {
      try { doc.image(logoBuffer, MR - 92, 14, { height: 72, fit: [88, 72] }); }
      catch (_) {}
    }

    // ── "INVOICE" title ───────────────────────────────────────────────────────
    doc.fillColor('#AAAAAA').font('Body').fontSize(36);
    doc.text('INVOICE', ML, 20);

    // ── Company info — left block ─────────────────────────────────────────────
    let cy = 100;
    doc.fillColor(DARK).font('Body-Bold').fontSize(9.5);
    doc.text('ABC Logistics.', ML, cy);            cy += 13;
    doc.text('6 ABDEL FATTAH YAHIA ST - RAMEL STATION', ML, cy); cy += 13;
    doc.text('ALEXANDRIA - 21265', ML, cy);         cy += 19;
    doc.text('20348008148', ML, cy);                cy += 13;
    doc.fillColor(ORANGE).font('Body').fontSize(9);
    doc.text('sales@abclogistics.com', ML, cy);

    // ── Meta table — right block ──────────────────────────────────────────────
    // Two columns: label (right-aligned) | value (bold/normal)
    const MTX   = 315;   // meta table left edge
    const MT_LW = 88;    // label column width
    const MT_VX = MTX + MT_LW + 6;  // value column start
    const MT_RH = 16;    // row height
    let   my    = 100;

    const metaRow = (label, value, boldVal = false, highlight = false) => {
      doc.fillColor(MID).font('Body').fontSize(8.5);
      doc.text(label, MTX, my + 3, { width: MT_LW, align: 'right' });
      doc.font(boldVal ? 'Body-Bold' : 'Body').fontSize(boldVal ? 9.5 : 9);
      doc.fillColor(highlight ? ORANGE : DARK);
      doc.text(value || '—', MT_VX, my + 3, { width: MR - MT_VX });
      // Bottom rule
      doc.rect(MTX, my + MT_RH - 0.5, MR - MTX, 0.5).fill(RULE);
      my += MT_RH;
    };

    metaRow('Date :', new Date(invoice.created_at).toLocaleDateString('en-GB'), true);
    metaRow('INV. No. :', invoice.custom_invoice_no || invoice.invoice_no, true);
    my += 3;
    metaRow('B/L # :', invoice.bl_number || '—');
    metaRow('POL :', invoice.pol || invoice.origin || '—');
    metaRow('POD :', invoice.pod || invoice.destination || '—');
    metaRow('SHIPMENT TYPE', invoice.shipment_type || invoice.service_type || '—', true, true);
    if (invoice.container_type || invoice.container_qty) {
      const cntr = [invoice.container_qty ? `${invoice.container_qty}x` : null, invoice.container_type]
        .filter(Boolean).join(' ');
      metaRow('CONTAINER', cntr, true);
    }

    // ── Horizontal rule separator ─────────────────────────────────────────────
    let y = Math.max(cy + 22, my + 10);
    doc.rect(ML, y, CW_I, 0.8).fill(DARK);
    y += 12;

    // ── BILL TO ───────────────────────────────────────────────────────────────
    doc.fillColor(DARK).font('Body-Bold').fontSize(9.5);
    doc.text('BILL TO :', ML, y);
    doc.rect(ML, y + 13, 130, 0.8).fill(DARK);   // underline
    y += 22;

    const BL_X = ML + 75;   // bill-to value column x

    const billRow = (label, value, multiline = false) => {
      doc.fillColor(MID).font('Body').fontSize(9);
      doc.text(label, ML, y);
      doc.fillColor(DARK).font('Body').fontSize(9);
      if (multiline && value) {
        doc.text(value, BL_X, y, { width: MR - BL_X });
        y += doc.heightOfString(value, { width: MR - BL_X }) + 5;
      } else {
        doc.text(value || '—', BL_X, y, { width: MR - BL_X });
        y += 15;
      }
    };

    billRow('NAME :', invoice.client_name || '—');
    billRow('ADDRESS', invoice.client_address || '—', true);
    if (invoice.client_country) {
      doc.fillColor(DARK).font('Body').fontSize(9);
      doc.text(`Country: ${invoice.client_country}`, BL_X, y);
      y += 15;
    }
    if (invoice.client_vat) {
      billRow('VAT:', invoice.client_vat);
    }
    y += 5;

    // ── SHIPMENT DETAILS ─────────────────────────────────────────────────────
    doc.fillColor(DARK).font('Body-Bold').fontSize(9.5);
    doc.text('SHIPMENT DETAILS :', ML, y);
    doc.rect(ML, y + 13, 145, 0.8).fill(DARK);
    y += 22;

    const SD_VX   = ML + 105;  // value x
    const SD_RLX  = ML + 265;  // right-pair label x
    const SD_RVX  = SD_RLX + 42; // right-pair value x

    // VESSEL
    doc.fillColor(MID).font('Body').fontSize(9);
    doc.text('VESSEL :', ML, y);
    doc.fillColor(ORANGE).font('Body-Bold').fontSize(9);
    doc.text(invoice.vessel || '—', SD_VX, y);
    y += 15;

    // SHIPPING LINE  +  POL
    doc.fillColor(MID).font('Body').fontSize(9);
    doc.text('SHIPPING LINE :', ML, y);
    doc.fillColor(ORANGE).font('Body-Bold').fontSize(9);
    doc.text(invoice.carrier || invoice.shipping_line || '—', SD_VX, y);
    doc.fillColor(MID).font('Body').fontSize(9);
    doc.text('POL:', SD_RLX, y);
    doc.fillColor(DARK).font('Body').fontSize(9);
    doc.text(invoice.pol || invoice.origin || '—', SD_RVX, y, { width: MR - SD_RVX });
    y += 15;

    // TYPE OF CNTR.  +  POD
    doc.fillColor(MID).font('Body').fontSize(9);
    doc.text('TYPE OF CNTR.', ML, y);
    doc.fillColor(ORANGE).font('Body-Bold').fontSize(9);
    doc.text(
      [invoice.container_qty ? `${invoice.container_qty}x` : null, invoice.container_type || invoice.cargo_type || invoice.service_type || '—']
        .filter(Boolean).join(' '),
      SD_VX, y
    );
    doc.fillColor(MID).font('Body').fontSize(9);
    doc.text('POD :', SD_RLX, y);
    doc.fillColor(DARK).font('Body').fontSize(9);
    doc.text(invoice.pod || invoice.destination || '—', SD_RVX, y, { width: MR - SD_RVX });
    y += 15;

    // CARGO TYPE
    if (invoice.cargo_type) {
      doc.fillColor(MID).font('Body').fontSize(9);
      doc.text('CARGO TYPE :', ML, y);
      doc.fillColor(DARK).font('Body').fontSize(9);
      doc.text(invoice.cargo_type, SD_VX, y);
      y += 15;
    }

    y -= 2;

    // ── CHARGES TABLE ─────────────────────────────────────────────────────────
    const TC_DESC = ML;           // description col start (x=40)
    const TC_QTY  = ML + 240;     // qty col start  (x=280)  — description: 240 px
    const TC_UP   = ML + 295;     // unit-price col (x=335)  — qty:          55 px
    const TC_AMT  = ML + 415;     // amount col     (x=455)  — unit-price:  120 px, amount: 100 px
    const TC_RH   = 24;           // row height (up from 22 for better breathing room)

    // Header row — orange background
    doc.rect(ML, y, CW_I, TC_RH).fill(ORANGE);
    doc.fillColor(WHITE).font('Body-Bold').fontSize(9);
    doc.text('DESCRIPTION', TC_DESC + 6,  y + 6, { width: TC_QTY - TC_DESC - 10 });
    doc.text('QTY',         TC_QTY,        y + 6, { width: TC_UP  - TC_QTY,  align: 'center' });
    doc.text('UNIT PRICE',  TC_UP  + 4,    y + 6, { width: TC_AMT - TC_UP  - 8,  align: 'right' });
    doc.text('AMOUNT',      TC_AMT + 4,    y + 6, { width: MR     - TC_AMT - 12, align: 'right' });
    y += TC_RH;

    // Determine charge rows
    const rawCharges = Array.isArray(invoice.charges) && invoice.charges.length > 0
      ? invoice.charges
      : [{
          description: invoice.description || 'Freight Services',
          qty: 1,
          unit_rate: parseFloat(invoice.amount || 0),
          amount:    parseFloat(invoice.amount || 0),
          currency:  invoice.currency,
        }];

    let grandTotal = 0;
    rawCharges.forEach((ch, idx) => {
      const amt    = parseFloat(ch.amount    || 0);
      const qty    = parseFloat(ch.qty       || 1);
      const ur     = parseFloat(ch.unit_rate || ch.unitRate || (qty ? amt / qty : amt));
      const curr   = ch.currency || invoice.currency || 'USD';
      grandTotal  += amt;

      const bg = idx % 2 === 0 ? WHITE : '#F4F4F4';
      doc.rect(ML, y, CW_I, TC_RH).fill(bg);

      // Vertical column dividers
      doc.rect(TC_QTY - 1, y, 0.5, TC_RH).fill(RULE);
      doc.rect(TC_UP  - 1, y, 0.5, TC_RH).fill(RULE);
      doc.rect(TC_AMT - 1, y, 0.5, TC_RH).fill(RULE);
      // Bottom border
      doc.rect(ML, y + TC_RH - 0.5, CW_I, 0.5).fill(RULE);

      doc.fillColor(DARK).font('Body').fontSize(9);
      doc.text(ch.description || '', TC_DESC + 6, y + 6, { width: TC_QTY - TC_DESC - 12 });
      doc.text(String(qty % 1 === 0 ? Math.round(qty) : qty.toFixed(2)),
               TC_QTY, y + 6, { width: TC_UP - TC_QTY - 2, align: 'center' });
      doc.text(`${curr}  ${ur.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
               TC_UP + 4,  y + 6, { width: TC_AMT - TC_UP  - 8,  align: 'right' });
      doc.text(`${curr}  ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
               TC_AMT + 4, y + 6, { width: MR    - TC_AMT - 12, align: 'right' });
      y += TC_RH;
    });

    // TOTAL row
    const TOTAL_H = 30;
    doc.rect(ML, y, CW_I, TOTAL_H).fill('#EBEBEB');
    doc.rect(ML, y, CW_I, TOTAL_H).lineWidth(0.7).strokeColor(RULE).stroke();
    doc.fillColor(DARK).font('Body-Bold').fontSize(12);
    doc.text('TOTAL', ML, y + 9, { width: TC_AMT - ML, align: 'center' });
    const invCurr = invoice.currency || 'USD';
    doc.text(
      `${invCurr}  ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      TC_AMT + 4, y + 9, { width: MR - TC_AMT - 12, align: 'right' }
    );
    y += TOTAL_H + 18;

    // ── BANK DETAILS ─────────────────────────────────────────────────────────
    const bankStartY = y;
    doc.fillColor(DARK).font('Body-Bold').fontSize(9.5);
    doc.text('BANK DETAILS :', ML, y);
    y += 15;

    doc.font('Body').fontSize(8.8).fillColor(DARK);
    BANK.forEach(line => {
      if (line) doc.text(line, ML, y);
      y += 13;
    });

    // Balance Due box — yellow/gold, right-aligned at mid-height of bank section
    const balY    = bankStartY + 15 + 13 * 3;  // about 3 lines down
    const BAL_X   = MR - 168;
    const BAL_W   = 168;
    const BAL_H   = 26;
    doc.rect(BAL_X, balY, BAL_W, BAL_H).fill('#F5C400');
    doc.fillColor(DARK).font('Body-Bold').fontSize(9.5);
    doc.text('Balance Due', BAL_X + 6, balY + 7, { width: 80 });
    doc.text(
      `${invCurr}  ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      BAL_X + 86, balY + 7, { width: BAL_W - 98, align: 'right' }
    );

    y += 8;

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const FOOT_H   = 50;
    const FOOT_Y_I = PH - FOOT_H;
    doc.rect(0, FOOT_Y_I, PW, FOOT_H).fill(ORANGE);
    doc.fillColor(WHITE).font('Body').fontSize(8.5);
    doc.text(DISCLAIMER, ML, FOOT_Y_I + 14, { width: CW_I, align: 'center' });

    doc.end();
  });
};
