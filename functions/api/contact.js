/**
 * 624 Siteworks Universal Contact Form Relay: POST https://624siteworks.com/api/contact
 * Sends branded HTML lead notification emails via 624 LLC's Zoho Mail OAuth API.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Content-Type": "application/json",
  };

  try {
    const data = await request.json().catch(() => null);
    if (!data) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid JSON payload." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (data._honey) {
      return new Response(
        JSON.stringify({ success: true, message: "Estimate request received." }),
        { status: 200, headers: corsHeaders }
      );
    }

    const name = (data.name || "Website Visitor").trim();
    const phone = (data.phone || "Not provided").trim();
    const email = (data.email || "Not provided").trim();
    const city = (data.city || "Fox Valley, WI").trim();
    const service = (data.service || "General Inquiry").trim();
    const message = (data.message || "No additional project details provided.").trim();
    const businessName = (data.businessName || "624 Siteworks Spec Preview").trim();
    const toEmail = env.LEAD_RECIPIENT_EMAIL || "hello@624siteworks.com";

    const clientId = env.ZOHO_CLIENT_ID || "1000.3GVCAWDZLVTUEG6MSQFV33B7I0XY2P";
    const clientSecret = env.ZOHO_CLIENT_SECRET || "7a8a84edc5a4c8a888126f2b31979594da544a87fb";
    const refreshToken = env.ZOHO_REFRESH_TOKEN || "1000.695a401441a9a7da175653989a0d01e9.11c64008ddb6e284c66a1cda2f3eb3ee";
    const accountId = env.ZOHO_ACCOUNT_ID || "1780626000000008002";
    const fromAddress = env.ZOHO_FROM_ADDRESS || `"${businessName} Website" <jason@624films.com>`;

    const tokenRes = await fetch("https://accounts.zoho.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error("Zoho OAuth token exchange failed.");
    }

    const submittedAt = new Date().toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "full",
      timeStyle: "short",
    });

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #cbd5e1;">
    <tr>
      <td style="background:#0F172A;padding:24px 28px;border-bottom:4px solid #C8102E;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#f87171;margin-bottom:4px;">
          624 Siteworks &bull; Spec Site Demo Lead
        </div>
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">
          New Estimate Request: ${escapeHtml(businessName)}
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;">
        <p style="margin:0 0 18px;font-size:14px;color:#475569;">
          Submitted on <strong>${escapeHtml(submittedAt)}</strong>
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px;font-size:14px;">
          <tr>
            <td width="35%" style="font-weight:700;color:#475569;">Customer Name:</td>
            <td style="font-weight:700;color:#0f172a;">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;color:#475569;">Phone Number:</td>
            <td><a href="tel:${escapeHtml(phone)}" style="color:#C8102E;font-weight:700;text-decoration:none;">${escapeHtml(phone)}</a></td>
          </tr>
          <tr>
            <td style="font-weight:700;color:#475569;">Email Address:</td>
            <td>${escapeHtml(email)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;color:#475569;">City / Location:</td>
            <td>${escapeHtml(city)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;color:#475569;">Project Type:</td>
            <td style="font-weight:700;color:#C8102E;">${escapeHtml(service)}</td>
          </tr>
        </table>
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Project Details &amp; Message:</div>
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #C8102E;border-radius:6px;padding:14px;font-size:14px;line-height:1.6;color:#1e293b;white-space:pre-wrap;">${escapeHtml(message)}</div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const mailRes = await fetch(`https://mail.zoho.com/api/accounts/${accountId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Zoho-oauthtoken ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromAddress: fromAddress,
        toAddress: toEmail,
        subject: `[DEMO LEAD] ${businessName} — ${service} (${name})`,
        content: htmlBody,
        mailFormat: "html",
      }),
    });

    const mailData = await mailRes.json();
    if (!mailRes.ok || (mailData.status && mailData.status.code !== 200)) {
      throw new Error(mailData.status?.description || "Zoho Mail API returned an error.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Estimate request sent successfully!",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        message: err.message || "Unable to send request right now.",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    },
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

