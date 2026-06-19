const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@freightos.app';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log(`[emailService] RESEND_API_KEY not set. Would send to ${to}: ${subject}`);
    return;
  }
  try {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[emailService] Resend API error ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error('[emailService] Failed to send email:', err.message);
  }
}

exports.sendInviteEmail = async (to, inviteLink, companyName) => {
  const subject = `You've been invited to join ${companyName} on FreightOS`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>You're invited!</h2>
      <p>You've been invited to join <strong>${companyName}</strong> on FreightOS.</p>
      <p>Click the button below to accept your invitation and set your password:</p>
      <p><a href="${inviteLink}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Accept Invitation</a></p>
      <p>This link expires in 7 days.</p>
      <p style="color:#666;font-size:12px">If you didn't expect this invite, you can safely ignore this email.</p>
    </div>`;
  await sendEmail(to, subject, html);
};

exports.sendTrialWarningEmail = async (to, daysLeft, companyName) => {
  const subject = `Your FreightOS trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Trial Ending Soon</h2>
      <p>Hi ${companyName} team,</p>
      <p>Your FreightOS trial ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
      <p>To continue using FreightOS, please contact us to upgrade your plan.</p>
      <p><a href="mailto:sales@freightos.app" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Contact Sales</a></p>
    </div>`;
  await sendEmail(to, subject, html);
};

exports.sendSuspensionEmail = async (to, companyName) => {
  const subject = `Your FreightOS account has been suspended`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Account Suspended</h2>
      <p>Hi ${companyName} team,</p>
      <p>Your FreightOS account has been suspended due to an expired subscription or trial.</p>
      <p>Your data is safe. Contact us to reactivate your account.</p>
      <p><a href="mailto:support@freightos.app" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Contact Support</a></p>
    </div>`;
  await sendEmail(to, subject, html);
};
