const PDFDocument = require('pdfkit');
const path = require('path');
const fs   = require('fs');
const http  = require('http');
const https = require('https');

const FONT_R = path.join(__dirname, '../../assets/LiberationSans-Regular.ttf');
const FONT_B = path.join(__dirname, '../../assets/LiberationSans-Bold.ttf');
const LOGO_FILE = path.join(__dirname, '../../assets/logo.png');

const ORANGE = '#1e40af';
const DARK   = '#1C1C1C';
const LIGHT  = '#888888';
const RULE   = '#AAAAAA';
const OFF    = '#F5F5F3';

const W  = 595;   // A4 portrait
const H  = 842;
const ML = 22;
const CW = W - ML * 2;

const fetchLogo = async () => {
  if (fs.existsSync(LOGO_FILE)) return fs.readFileSync(LOGO_FILE);
  const URL = process.env.COMPANY_LOGO || 'https://www.abclogistics.com/SubmarkLogo.png';
  return new Promise(resolve => {
    const client = URL.startsWith('https') ? https : http;
    client.get(URL, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null));
  });
};

// ── Scaled drawing helpers ────────────────────────────────────────────────────
// All raw coordinates are in "design space" (unscaled). The SY / SH / SF
// helpers convert them to page space so content always fits on one page.

function makeHelpers(scale, startY) {
  const SY = rawY => startY + (rawY - startY) * scale;
  const SH = h    => h * scale;
  const SF = f    => Math.max(4, f * scale);
  return { SY, SH, SF };
}

// Draw a labelled cell in scaled coordinates.
function box(doc, label, value, x, rawY, w, rawH, opts, SY, SH, SF) {
  const { bold = false, fs: fontSize = 8, lfs = 6, fill = null, color = DARK } = opts || {};
  const y = SY(rawY);
  const h = SH(rawH);

  if (fill) doc.rect(x, y, w, h).fillAndStroke(fill, RULE);
  else      doc.rect(x, y, w, h).stroke(RULE);

  let labelH = 0;
  if (label) {
    doc.fillColor(LIGHT).font('R').fontSize(SF(lfs));
    labelH = doc.heightOfString(label, { width: w - 6 });
    doc.text(label, x + 3, y + 2, { width: w - 6 });
  }

  const textY = y + labelH + 3;
  const textH = Math.max(1, h - labelH - 5);
  if (value) {
    doc.fillColor(color).font(bold ? 'B' : 'R').fontSize(SF(fontSize))
       .text(value, x + 3, textY, { width: w - 6, height: textH, lineBreak: true });
  }
}

// Header-only cell (label centred, OFF background).
function hdr(doc, label, x, rawY, w, rawH, SY, SH, SF) {
  const y = SY(rawY);
  const h = SH(rawH);
  doc.rect(x, y, w, h).fillAndStroke(OFF, RULE);
  doc.fillColor(DARK).font('B').fontSize(SF(7));
  const lh = doc.heightOfString(label.toUpperCase(), { width: w - 4 });
  doc.text(label.toUpperCase(), x + 2, y + Math.max(1, (h - lh) / 2), { width: w - 4, align: 'center' });
}

// ── Content height measurement ────────────────────────────────────────────────
// Returns the total raw height of all drawn sections so the scale factor
// can be derived before any drawing happens.
function measureHeight(bl, doc) {
  const shipperW = Math.round(CW * 0.46);
  const rightW   = CW - shipperW;
  const blRowH   = 40;
  const statusH  = 16;
  const logoBoxH = 80;

  let h = blRowH + statusH + logoBoxH;   // section 1

  // section 2: consignee/notify — use actual text heights
  const sec2LeftH  = measureCell(doc, bl.consignee,    Math.round(CW * 0.46) - 6, 9);
  const sec2RightH = measureCell(doc, bl.notify_party, CW - Math.round(CW * 0.46) - 6, 9);
  h += Math.max(sec2LeftH, sec2RightH, 50);

  // section 3: pre-carriage/place + also notify
  const preH      = measureCell(doc, bl.pre_carriage,    Math.round(CW * 0.46) - 6, 9);
  const recH      = measureCell(doc, bl.place_of_receipt, Math.round(CW * 0.46) - 6, 9);
  const alsoH     = measureCell(doc, bl.also_notify,     CW - Math.round(CW * 0.46) - 6, 9);
  h += Math.max(preH + recH, alsoH, 45);

  h += 34;  // section 4 port details
  h += 30;  // section 5 vessel
  h += 22;  // cargo header

  // cargo data — fixed generous height
  const descH = measureCell(doc, bl.description, CW * 0.38 - 8, 9);
  h += Math.max(descH + 12, 90);

  h += 18;  // total row
  h += 16;  // freight header
  h += 16;  // freight value
  h += 28;  // row 11 (payment)
  h += 24;  // row 12 (agent)
  h += 50;  // row 13 (delivery)

  return h;
}

function measureCell(doc, text, width, fontSize) {
  if (!text) return 0;
  doc.font('R').fontSize(fontSize);
  return doc.heightOfString(text, { width }) + 10;
}

// ── Main export ───────────────────────────────────────────────────────────────
exports.generateBlPdf = async (bl, settings = {}) => {
  const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: `B/L ${bl.bl_no || ''}` } });
  doc.registerFont('R', FONT_R);
  doc.registerFont('B', FONT_B);

  const buffers = [];
  doc.on('data', b => buffers.push(b));

  return new Promise(async (resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    const logoBuffer = await fetchLogo();

    // ── Compute scale so everything fits between y=18 and y=H-18 ────────────
    const START_Y  = 18;
    const END_Y    = H - 18;
    const AVAIL    = END_Y - START_Y;
    const rawTotal = measureHeight(bl, doc);
    const scale    = Math.min(1.0, AVAIL / rawTotal);
    const { SY, SH, SF } = makeHelpers(scale, START_Y);

    // ── PAGE BORDER ───────────────────────────────────────────────────────────
    doc.rect(ML, START_Y, CW, AVAIL).stroke(RULE);

    let rawY = START_Y;

    // ── SECTION 1: SHIPPER | B/L + BOOKING + STATUS + LOGO ──────────────────
    const shipperW = Math.round(CW * 0.46);
    const rightW   = CW - shipperW;
    const blRowH   = 40;
    const statusH  = 16;
    const logoBoxH = 80;
    const sec1H    = blRowH + statusH + logoBoxH;

    box(doc, 'SHIPPER:', bl.shipper, ML, rawY, shipperW, sec1H, { fs: 10, lfs: 7 }, SY, SH, SF);

    const blNoW = Math.round(rightW * 0.56);
    const bkgW  = rightW - blNoW;
    box(doc, 'B/L NO.:', bl.bl_no,      ML + shipperW,         rawY, blNoW, blRowH, { bold: true, fs: 11, lfs: 7, color: '#1C3557' }, SY, SH, SF);
    box(doc, 'BOOKING :', bl.booking_no, ML + shipperW + blNoW, rawY, bkgW,  blRowH, { bold: true, fs: 10, lfs: 7 }, SY, SH, SF);

    // Status bar
    const statusRawY = rawY + blRowH;
    doc.rect(ML + shipperW, SY(statusRawY), rightW, SH(statusH)).fillAndStroke('#F0F0EE', RULE);
    const statusColor = bl.status === 'Original' ? ORANGE : bl.status === 'Draft' ? '#888' : DARK;
    doc.fillColor(statusColor).font('B').fontSize(SF(10))
       .text((bl.status || 'DRAFT').toUpperCase(), ML + shipperW, SY(statusRawY) + SH(4), { width: rightW, align: 'center', lineBreak: false });

    // Logo box
    const logoRawY = statusRawY + statusH;
    doc.rect(ML + shipperW, SY(logoRawY), rightW, SH(logoBoxH)).stroke(RULE);
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, ML + shipperW, SY(logoRawY), {
          fit:    [rightW, SH(logoBoxH)],
          align:  'center',
          valign: 'center',
        });
      } catch (_) {}
    }

    rawY += sec1H;

    // ── SECTION 2: CONSIGNEE + NOTIFY ────────────────────────────────────────
    const consW   = Math.round(CW * 0.46);
    const notW    = CW - consW;
    const sec2LeftH  = measureCell(doc, bl.consignee,    consW - 6, 9);
    const sec2RightH = measureCell(doc, bl.notify_party, notW  - 6, 9);
    const sec2H = Math.max(sec2LeftH, sec2RightH, 50);

    box(doc, 'CONSIGN:', bl.consignee,    ML,          rawY, consW, sec2H, { fs: 9, lfs: 7 }, SY, SH, SF);
    box(doc, 'NOTIFY:',  bl.notify_party, ML + consW,  rawY, notW,  sec2H, { fs: 9, lfs: 7 }, SY, SH, SF);
    rawY += sec2H;

    // ── SECTION 3: PRE-CARRIAGE / PLACE OF RECEIPT | ALSO NOTIFY ─────────────
    const leftS3W  = Math.round(CW * 0.46);
    const rightS3W = CW - leftS3W;
    const preH2    = measureCell(doc, bl.pre_carriage,     leftS3W  - 6, 9);
    const recH2    = measureCell(doc, bl.place_of_receipt, leftS3W  - 6, 9);
    const alsoH2   = measureCell(doc, bl.also_notify,      rightS3W - 6, 9);
    const sec3H    = Math.max(preH2 + recH2, alsoH2, 45);
    const preH3    = Math.round(sec3H / 2);

    box(doc, 'PRE-CARRIAGE BY:',  bl.pre_carriage,     ML,           rawY,          leftS3W, preH3,          { fs: 9, lfs: 7 }, SY, SH, SF);
    box(doc, 'PLACE OF RECEIPT:', bl.place_of_receipt, ML,           rawY + preH3,  leftS3W, sec3H - preH3,  { fs: 9, lfs: 7 }, SY, SH, SF);
    box(doc, 'ALSO NOTIFY :',     bl.also_notify,      ML + leftS3W, rawY,          rightS3W, sec3H,         { fs: 9, lfs: 7 }, SY, SH, SF);
    rawY += sec3H;

    // ── SECTION 4: PORT DETAILS ───────────────────────────────────────────────
    const sec4H = 34;
    const portCols = [
      ['PORT OF LOADING :',   bl.pol,               CW * 0.24],
      ['PORT OF DISCHARGE :', bl.pod,               CW * 0.28],
      ["FINAL DESTINATION\n(FOR THE MERCHANT'S REFERENCE ONLY)", bl.final_destination, CW * 0.48],
    ];
    let cx = ML;
    for (const [label, value, w] of portCols) {
      box(doc, label, value, cx, rawY, w, sec4H, { fs: 9, lfs: 7 }, SY, SH, SF);
      cx += w;
    }
    rawY += sec4H;

    // ── SECTION 5: VESSEL ─────────────────────────────────────────────────────
    const sec5H = 30;
    const vesselCols = [
      ['OCEAN VESSEL :',     bl.vessel,            CW * 0.32],
      ['VOY. NO.:',          bl.voyage_no,         CW * 0.18],
      ['PLACE OF DELIVERY:', bl.place_of_delivery, CW * 0.50],
    ];
    cx = ML;
    for (const [label, value, w] of vesselCols) {
      box(doc, label, value, cx, rawY, w, sec5H, { fs: 9, lfs: 7 }, SY, SH, SF);
      cx += w;
    }
    rawY += sec5H;

    // ── SECTION 6: CARGO TABLE HEADER ─────────────────────────────────────────
    const thH = 22;
    const cargoCols = [
      ['COUNTAINER NO.\n& SEAL NO.',  CW * 0.17],
      ['NO. OF PKGS:\nKIND OF PKGS:', CW * 0.13],
      ['DESCRIPTION OF GOODS',        CW * 0.38],
      ['GROSS\nWEIGHT',               CW * 0.165],
      ['MEASURE-\nMENT',              CW * 0.155],
    ];
    cx = ML;
    for (const [label, w] of cargoCols) {
      hdr(doc, label, cx, rawY, w, thH, SY, SH, SF);
      cx += w;
    }
    rawY += thH;

    // ── SECTION 7: CARGO DATA ─────────────────────────────────────────────────
    const descMeasured = measureCell(doc, bl.description, cargoCols[2][1] - 8, 9);
    const cargoH = Math.max(descMeasured + 12, 90);
    cx = ML;
    const cargoVals = [bl.container_no, bl.no_of_pkgs, bl.description, bl.gross_weight, bl.measurement];
    for (let i = 0; i < cargoCols.length; i++) {
      const w = cargoCols[i][1];
      doc.rect(cx, SY(rawY), w, SH(cargoH)).stroke(RULE);
      doc.fillColor(DARK).font('R').fontSize(SF(9))
         .text(cargoVals[i] || '', cx + 4, SY(rawY) + 5, { width: w - 8, height: SH(cargoH) - 10, lineBreak: true });
      cx += w;
    }
    rawY += cargoH;

    // ── SECTION 8: TOTAL ROW ──────────────────────────────────────────────────
    const totH = 18;
    cx = ML;
    doc.rect(cx, SY(rawY), cargoCols[0][1], SH(totH)).fillAndStroke(OFF, RULE);
    doc.fillColor(DARK).font('B').fontSize(SF(9)).text('TOTAL', cx + 4, SY(rawY) + SH(4), { width: cargoCols[0][1] - 8, lineBreak: false });
    cx += cargoCols[0][1];
    doc.rect(cx, SY(rawY), cargoCols[1][1], SH(totH)).stroke(RULE);
    doc.fillColor(DARK).font('B').fontSize(SF(9)).text(bl.no_of_pkgs || '', cx + 4, SY(rawY) + SH(4), { width: cargoCols[1][1] - 8, lineBreak: false });
    cx += cargoCols[1][1];
    doc.rect(cx, SY(rawY), cargoCols[2][1], SH(totH)).stroke(RULE); cx += cargoCols[2][1];
    doc.rect(cx, SY(rawY), cargoCols[3][1], SH(totH)).stroke(RULE);
    doc.fillColor(DARK).font('B').fontSize(SF(9)).text(bl.gross_weight || '', cx + 4, SY(rawY) + SH(4), { width: cargoCols[3][1] - 8, lineBreak: false });
    cx += cargoCols[3][1];
    doc.rect(cx, SY(rawY), cargoCols[4][1], SH(totH)).stroke(RULE);
    rawY += totH;

    // ── SECTION 9: FREIGHT HEADER ─────────────────────────────────────────────
    const frtH = 16;
    const frtCols = [
      ['FREIGHT & CHARGES', CW * 0.28],
      ['REVENUE TONS',      CW * 0.12],
      ['RATE',              CW * 0.12],
      ['PER',               CW * 0.08],
      ['PREPAID',           CW * 0.20],
      ['COLLECT',           CW * 0.20],
    ];
    cx = ML;
    for (const [label, w] of frtCols) {
      hdr(doc, label, cx, rawY, w, frtH, SY, SH, SF);
      cx += w;
    }
    rawY += frtH;

    // ── SECTION 10: FREIGHT VALUE ─────────────────────────────────────────────
    const frtValH = 16;
    cx = ML;
    doc.rect(cx, SY(rawY), frtCols[0][1], SH(frtValH)).stroke(RULE);
    doc.fillColor(DARK).font('R').fontSize(SF(9)).text(bl.freight_charges || 'AS ARRANGED', cx + 4, SY(rawY) + SH(4), { width: frtCols[0][1] - 8, lineBreak: false });
    for (let i = 1; i < frtCols.length; i++) {
      cx += frtCols[i - 1][1];
      doc.rect(cx, SY(rawY), frtCols[i][1], SH(frtValH)).stroke(RULE);
    }
    rawY += frtValH;

    // ── BOTTOM BLOCK: fill actual remaining page space ────────────────────────
    // Convert the remaining page pixels back to raw coords so the bottom rows
    // always reach the page border regardless of scale factor.
    const pageRemainPx = (END_Y - SY(rawY));
    const rawRemain    = pageRemainPx / scale;
    const row11H = Math.round(rawRemain * 0.28);
    const row12H = Math.round(rawRemain * 0.22);
    const row13H = rawRemain - row11H - row12H;

    // Row 11
    const dateStr = bl.date_issued
      ? new Date(bl.date_issued).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    const r11cols = [
      ['EX RATE:',    '',                           CW * 0.10],
      ['PAYMENT AT:', bl.payment_terms || 'COLLECT', CW * 0.18],
      ['PAYABLE AT',  bl.payment_terms || 'COLLECT', CW * 0.18],
      ['PLACE OF B(S)/L ISSUED :', `${bl.place_issued || 'ALEXANDRIA'}     DATED: ${dateStr}`, CW * 0.54],
    ];
    cx = ML;
    for (const [label, value, w] of r11cols) {
      box(doc, label, value, cx, rawY, w, row11H, { fs: 9, lfs: 7 }, SY, SH, SF);
      cx += w;
    }
    rawY += row11H;

    // Row 12
    const r12cols = [
      ['',                               '',                              CW * 0.28],
      ['TOTAL PREPAID IN LOCAL CURRENCY','',                              CW * 0.18],
      ['NUMBER OF BL',                   String(bl.no_of_originals || 3), CW * 0.18],
      ['AS AGENT:',                      'ABC Logistics.',               CW * 0.36],
    ];
    cx = ML;
    for (const [label, value, w] of r12cols) {
      box(doc, label, value, cx, rawY, w, row12H, {
        bold: label === 'AS AGENT:' || label === 'NUMBER OF BL',
        fs: label === 'AS AGENT:' ? 10 : label === 'NUMBER OF BL' ? 12 : 9,
        lfs: 7,
      }, SY, SH, SF);
      cx += w;
    }
    rawY += row12H;

    // Row 13
    const delivW = Math.round(CW * 0.60);
    const agentW = CW - delivW;
    box(doc, 'FOR DELIVERY OF GOODS PLEASE APPLY TO :', bl.delivery_agent, ML, rawY, delivW, row13H, { fs: 9, lfs: 7 }, SY, SH, SF);
    doc.rect(ML + delivW, SY(rawY), agentW, SH(row13H)).stroke(RULE);
    doc.fillColor(ORANGE).font('B').fontSize(SF(14))
       .text('ABC Logistics.', ML + delivW, SY(rawY) + SH(row13H) / 2 - SF(8), { width: agentW, align: 'center', lineBreak: false });

    // ── WATERMARK ─────────────────────────────────────────────────────────────
    const wm = (bl.status || 'DRAFT').toUpperCase();
    doc.save();
    doc.translate(W / 2, H / 2).rotate(-45);
    doc.fillColor(wm === 'ORIGINAL' ? '#1C3557' : '#CCCCCC').font('B').fontSize(90)
       .opacity(0.07)
       .text(wm, -180, -45, { width: 360, align: 'center', lineBreak: false });
    doc.restore();
    doc.opacity(1);

    doc.end();
  });
};
