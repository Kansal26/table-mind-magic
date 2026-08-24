import { Resend } from 'resend';

// Only initialize if the API key is present
const resend = process.env['RESEND_API_KEY'] ? new Resend(process.env['RESEND_API_KEY']) : null;

interface OrderItem {
  name: string;
  qty: number;
  customizations?: any;
}

export function emailLayout({
  previewText,
  accentColor = "#C9622A",
  bodyHtml,
}: { previewText: string; accentColor?: string; bodyHtml: string }) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>TableMind</title>
</head>
<body style="margin:0; padding:0; background-color:#F5EFE6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5EFE6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:24px; text-align:center;">
              <span style="font-size:22px; font-weight:700; color:#1A2E4A; letter-spacing:-0.5px;">TableMind</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF; border-radius:16px; padding:36px; box-shadow: 0 2px 8px rgba(26,46,74,0.06);">
              <div style="height:4px; width:48px; background-color:${accentColor}; border-radius:2px; margin-bottom:24px;"></div>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#8A94A6;">
                Powered by TableMind — smart ordering for restaurants
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string, color = "#1A2E4A") {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td style="border-radius:10px; background-color:${color};">
        <a href="${href}" style="display:inline-block; padding:13px 28px; font-size:14px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:10px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

export function billBreakdownHtml({
  items, subtotal, discount, creditsApplied, tax, total,
}: {
  items: { name: string; qty: number; customizations?: string | null }[];
  subtotal: number; discount?: number; creditsApplied?: number;
  tax: number; total: number;
}) {
  const money = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  const itemRows = items.map(i => `
    <tr>
      <td style="padding:6px 0; font-size:14px; color:#1A2E4A;">
        ${i.qty}× ${i.name}${i.customizations ? `<br/><span style="font-size:12px; color:#8A94A6;">${i.customizations}</span>` : ""}
      </td>
    </tr>`).join("");

  const row = (label: string, value: string, opts?: { bold?: boolean; color?: string }) => `
    <tr>
      <td style="padding:4px 0; font-size:${opts?.bold ? "15px" : "13px"}; color:${opts?.color || "#5A6472"}; font-weight:${opts?.bold ? "700" : "400"};">${label}</td>
      <td align="right" style="padding:4px 0; font-size:${opts?.bold ? "15px" : "13px"}; color:${opts?.color || "#5A6472"}; font-weight:${opts?.bold ? "700" : "400"};">${value}</td>
    </tr>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0; padding:16px 0; border-top:1px solid #EEE6DA; border-bottom:1px solid #EEE6DA;">
    ${itemRows}
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${row("Subtotal", money(subtotal))}
    ${discount ? row("Discount", `-${money(discount)}`, { color: "#C9622A" }) : ""}
    ${creditsApplied ? row("Points redeemed", `-${money(creditsApplied)}`, { color: "#0D7377" }) : ""}
    ${row("Tax", money(tax))}
    <tr><td colspan="2" style="padding-top:8px;"><div style="border-top:1px solid #1A2E4A0F;"></div></td></tr>
    ${row("Total", money(total), { bold: true, color: "#1A2E4A" })}
  </table>`;
}

export function otpEmailHtml({
  heading, message, code, accentColor, warningText,
}: { heading: string; message: string; code: string; accentColor: string; warningText?: string }) {
  return `
<h1 style="margin:0 0 8px; font-size:20px; color:#1A2E4A;">${heading}</h1>
<p style="margin:0 0 24px; font-size:14px; color:#5A6472; line-height:1.6;">
  ${message}
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="background-color:#F5EFE6; border-radius:12px; padding:20px;">
      <span style="font-size:32px; font-weight:700; letter-spacing:8px; color:${accentColor};">${code}</span>
    </td>
  </tr>
</table>
<p style="margin:16px 0 0; font-size:12px; color:#8A94A6;">
  This code expires in 10 minutes. Never share it with anyone.
</p>
${warningText ? `
<div style="margin-top:20px; padding:14px 16px; background-color:#FDF1EE; border-left:3px solid #C0392B; border-radius:4px;">
  <p style="margin:0; font-size:13px; color:#9C3421; line-height:1.5;">${warningText}</p>
</div>` : ""}
`;
}

export async function sendNewOrderNotification(params: {
  restaurantName: string;
  tableName: string;
  orderItems: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  ownerEmail: string;
  orderId: string;
}) {
  const { restaurantName, tableName, orderItems, subtotal, discount, total, ownerEmail, orderId } = params;

  if (!resend) {
    console.warn("sendNewOrderNotification: RESEND_API_KEY not set. Email not sent.");
    return null;
  }

  const formattedISTTimestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });

  const items = orderItems.map(item => {
    let customText = "";
    if (item.customizations && typeof item.customizations === 'object') {
      const keys = Object.keys(item.customizations);
      if (keys.length > 0) {
         customText = keys.map(k => item.customizations[k]).join(', ');
      }
    } else if (typeof item.customizations === 'string') {
       customText = item.customizations;
    }
    return { name: item.name, qty: item.qty, customizations: customText || null };
  });

  const dashboardUrl = `${process.env['VITE_APP_URL'] || process.env['PUBLIC_URL'] || "http://localhost:5173"}/admin/dashboard`;

  const bodyHtml = `
<h1 style="margin:0 0 4px; font-size:20px; color:#1A2E4A;">New order received</h1>
<p style="margin:0 0 20px; font-size:14px; color:#8A94A6;">
  ${restaurantName} — ${tableName} · ${formattedISTTimestamp}
</p>
${billBreakdownHtml({ items, subtotal, discount, tax: 0, total })}
<p style="margin:20px 0 0; font-size:12px; color:#8A94A6;">
  Order ID: ${orderId}
</p>
${emailButton(dashboardUrl, "View on dashboard")}
`;

  const html = emailLayout({
    previewText: `New order from ${tableName}`,
    accentColor: "#C9622A",
    bodyHtml
  });

  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ownerEmail,
      subject: `New order — ${tableName} at ${restaurantName}`,
      html: html
    });
    console.log("Email sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Failed to send order notification email:", error);
    return null;
  }
}

export async function sendGuestReceiptEmail(params: {
  guestEmail: string;
  restaurantName: string;
  tableName: string;
  orderItems: OrderItem[];
  subtotal: number;
  discount: number;
  creditsApplied: number;
  tax: number;
  total: number;
  orderId: string;
}) {
  const { guestEmail, restaurantName, tableName, orderItems, subtotal, discount, creditsApplied, tax, total, orderId } = params;

  if (!resend) {
    console.warn("sendGuestReceiptEmail: RESEND_API_KEY not set. Email not sent.");
    return;
  }

  const formattedISTTimestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });

  const items = orderItems.map(item => {
    let customText = "";
    if (item.customizations && typeof item.customizations === 'object') {
      const keys = Object.keys(item.customizations);
      if (keys.length > 0) {
         customText = keys.map(k => item.customizations[k]).join(', ');
      }
    } else if (typeof item.customizations === 'string') {
       customText = item.customizations;
    }
    return { name: item.name, qty: item.qty, customizations: customText || null };
  });

  const bodyHtml = `
<h1 style="margin:0 0 4px; font-size:20px; color:#1A2E4A;">Thank you for dining with us</h1>
<p style="margin:0 0 20px; font-size:14px; color:#8A94A6;">
  ${restaurantName} — ${tableName} · ${formattedISTTimestamp}
</p>
${billBreakdownHtml({ items, subtotal, discount, creditsApplied, tax, total })}
<p style="margin:20px 0 0; font-size:12px; color:#8A94A6;">
  Order ID: ${orderId}
</p>
<p style="margin:16px 0 0; font-size:13px; color:#5A6472;">
  We hope to see you again soon.
</p>
`;

  const html = emailLayout({
    previewText: `Your receipt from ${restaurantName}`,
    accentColor: "#C9622A",
    bodyHtml
  });

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: guestEmail,
      subject: `Your receipt from ${restaurantName}`,
      html,
    });
  } catch (error) {
    console.error("Failed to send guest receipt email via Resend:", error);
  }
}

export async function sendRestaurantWelcomeEmail(params: {
  ownerEmail: string;
  restaurantName: string;
  ownerName: string;
}) {
  const { ownerEmail, restaurantName, ownerName } = params;

  if (!resend) {
    console.warn("sendRestaurantWelcomeEmail: RESEND_API_KEY not set. Email not sent.");
    return null;
  }

  const baseUrl = process.env['VITE_APP_URL'] || process.env['PUBLIC_URL'] || "http://localhost:5173";
  const dashboardUrl = `${baseUrl}/admin/dashboard`;

  const bodyHtml = `
<h1 style="margin:0 0 8px; font-size:22px; color:#1A2E4A;">Welcome aboard${ownerName ? `, ${ownerName}` : ""}!</h1>
<p style="margin:0 0 20px; font-size:14px; color:#5A6472; line-height:1.6;">
  ${restaurantName} is now live on TableMind. Here's what to set up next
  to get your first order flowing:
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
  ${["Add your menu items", "Generate QR codes for your tables", "Customize your branding (logo, banner)", "Set up coupons (optional)", "Configure your loyalty points program (optional)"]
    .map(step => `
    <tr>
      <td style="padding:8px 0; font-size:14px; color:#1A2E4A; border-bottom:1px solid #F5EFE6;">
        <span style="color:#C9622A; margin-right:8px; font-weight:700;">—</span>${step}
      </td>
    </tr>`).join("")}
</table>
${emailButton(dashboardUrl, "Go to your dashboard")}
`;

  const html = emailLayout({
    previewText: `Welcome to TableMind, ${restaurantName}!`,
    accentColor: "#C9622A",
    bodyHtml
  });

  try {
    console.log('[WELCOME EMAIL] Calling Resend API...')
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ownerEmail,
      subject: `Welcome to TableMind, ${restaurantName}`,
      html: html
    });
    console.log('[WELCOME EMAIL] Resend response:', JSON.stringify(data))
    console.log("Welcome email sent successfully:", data);
    return data;
  } catch (error) {
    console.error('[WELCOME EMAIL] FAILED:', error);
    return null;
  }
}

