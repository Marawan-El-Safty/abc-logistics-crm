const { Resend } = require('resend');
const { pool } = require('../config/db');

const FROM = 'ABC Logistics <demo@abclogistics.com>';

const LOGOS_URL = '';

function buildSignature(senderName, senderTitle, senderPhone, senderPhone2, senderPhone3, senderEmail, senderSalutation, companyAddress) {
  const salutation = senderSalutation ? `${senderSalutation} ` : '';
  const name = senderName || 'ABC Logistics';
  const displayName = `${salutation}${name}`;
  const email = senderEmail || 'demo@abclogistics.com';
  const address = companyAddress || '6 Abdel Fattah Yahya St. - Ramel Station, Alexandria – Egypt';

  const phones = [senderPhone, senderPhone2, senderPhone3].filter(Boolean);
  const phonesText = phones.join('  ·  ');

  const titleLine = senderTitle ? `\n${senderTitle}` : '';
  const text = `\n--\n${displayName}${titleLine}\nABC Logistics – Shipping & Logistics\n${address}\n${phonesText}\n${email}  ·  www.abclogistics.com\n`;

  const titleHtml = senderTitle
    ? `<div style="font-size:12px;color:#666;margin-bottom:2px;">${senderTitle}</div>` : '';
  const phonesHtml = phones.map(p => `<span>${p}</span>`).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const html = `<br/>
<table style="border-top:2px solid #d4af37;padding-top:14px;font-family:Calibri,Arial,sans-serif;font-size:13px;color:#333;border-collapse:collapse;" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding-right:18px;vertical-align:top;padding-top:4px;">
      <img src="https://www.abclogistics.com/SubmarkLogo.png" width="70" style="display:block;" alt="ABC Logistics" />
    </td>
    <td style="vertical-align:top;border-left:3px solid #d4af37;padding-left:16px;">
      <div style="font-size:16px;font-weight:bold;color:#1a1a2e;margin-bottom:2px;">${displayName}</div>
      ${titleHtml}
      <div style="font-size:10px;color:#999;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:6px;margin-top:2px;">ABC Logistics &nbsp;&middot;&nbsp; Shipping &amp; Logistics</div>
      <div style="border-top:1px solid #e8e8e8;padding-top:6px;">
        <div style="font-size:12px;color:#555;margin-bottom:3px;">${address}</div>
        ${phonesHtml ? `<div style="font-size:12px;color:#555;margin-bottom:3px;">${phonesHtml}</div>` : ''}
        <div style="font-size:12px;margin-top:2px;">
          <a href="mailto:${email}" style="color:#d4af37;text-decoration:none;">${email}</a>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          <a href="http://www.abclogistics.com" style="color:#d4af37;text-decoration:none;">www.abclogistics.com</a>
        </div>
      </div>
    </td>
  </tr>
</table>
<div style="margin-top:12px;">
  <img src="${LOGOS_URL}" alt="Partner Logos" style="max-width:380px;display:block;" />
</div>`;

  return { text, html };
}

function personalize(text, companyName) {
  return text.replace(/\[?Company Name\]?/g, companyName);
}

const TEMPLATES = {
  rate_request: {
    label: 'Rate Request (Freight Forwarder)',
    subject: (data) => `Rate Inquiry – ${data.companyName}`,
    body: (data) => `Dear ${data.companyName} Team,

We hope this message finds you well.

We are reaching out to request your latest freight rates for the following services:

- Origin / Destination: [Please specify]
- Commodity: [Please specify]
- Container Type: [Please specify]
- ETD: [Please specify]

Kindly share your best competitive rates at your earliest convenience.

Thank you for your continued support.`,
  },
  shipping_line_inquiry: {
    label: 'Shipping Line Inquiry',
    subject: (data) => `Shipment Schedule & Rate Inquiry – ${data.companyName}`,
    body: (data) => `Dear ${data.companyName} Team,

Greetings from ABC Logistics.

We would like to request your latest sailing schedules and freight rates for the following trade lanes:

- Trade Lane: [Please specify]
- Container Type: [Please specify]
- Effective Date: [Please specify]

Please share your updated schedule and rate sheet at your earliest convenience.

We look forward to your response.`,
  },
  custom: {
    label: 'Custom Email',
    subject: () => '',
    body: () => '',
  },
};

exports.getTemplates = (req, res) => {
  const templates = Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label }));
  res.json(templates);
};

exports.previewTemplate = (req, res) => {
  const { template, companyName } = req.query;
  const t = TEMPLATES[template];
  if (!t) return res.status(404).json({ error: 'Template not found' });
  const data = { companyName: companyName || '{Company Name}' };
  const { text: sigText } = buildSignature('', '', '', '', '', '', '', '');
  res.json({ subject: t.subject(data), body: t.body(data) + sigText });
};

exports.send = async (req, res) => {
  const { contactIds, template, subject, body, senderName, senderTitle, senderPhone, senderPhone2, senderPhone3, senderEmail, senderSalutation, companyAddress } = req.body;

  if (!contactIds?.length) return res.status(400).json({ error: 'No contacts selected' });
  if (!template) return res.status(400).json({ error: 'Template required' });
  if (!subject?.trim()) return res.status(400).json({ error: 'Subject required' });
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Email not configured. Set RESEND_API_KEY environment variable.' });
  }

  const { rows: contacts } = await pool.query(
    `SELECT id, company_name, email FROM clients WHERE id = ANY($1::uuid[]) AND email IS NOT NULL AND email != ''`,
    [contactIds]
  );

  if (!contacts.length) return res.status(400).json({ error: 'None of the selected contacts have an email address' });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const results = [];

  const { text: sigText, html: sigHtml } = buildSignature(senderName, senderTitle, senderPhone, senderPhone2, senderPhone3, senderEmail, senderSalutation, companyAddress);

  for (const contact of contacts) {
    const name = contact.company_name;
    const personalSubject = personalize(subject, name);
    // Strip any signature the frontend may have appended before re-adding a fresh one
    const bodyCore = body.replace(/\n--\n[\s\S]*$/, '').trimEnd();
    const personalBody = personalize(bodyCore, name);
    const fullText = personalBody + sigText;
    const fullHtml = `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;">${personalBody.replace(/\n/g, '<br/>')}</div>${sigHtml}`;

    let status = 'sent';
    let error = null;
    try {
      const { error: resendError } = await resend.emails.send({
        from: FROM,
        to: contact.email,
        subject: personalSubject,
        text: fullText,
        html: fullHtml,
      });
      if (resendError) throw new Error(resendError.message);
    } catch (err) {
      status = 'failed';
      error = err.message;
    }

    await pool.query(
      `INSERT INTO email_logs (client_id, template, subject, body, recipient, status, error, sent_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [contact.id, template, personalSubject, personalBody, contact.email, status, error, req.user.id]
    );

    results.push({ company: name, email: contact.email, status, error });
  }

  const failed = results.filter(r => r.status === 'failed').length;
  res.json({ sent: results.length - failed, failed, results });
};

exports.getLogs = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT el.*, c.company_name, u.full_name as sent_by_name
     FROM email_logs el
     LEFT JOIN clients c ON c.id = el.client_id
     LEFT JOIN users u ON u.id = el.sent_by
     ORDER BY el.sent_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM email_logs`);
  res.json({ logs: rows, total: parseInt(count) });
};
