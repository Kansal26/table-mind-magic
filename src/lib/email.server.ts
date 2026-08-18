import { Resend } from 'resend';

// Only initialize if the API key is present
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface OrderItem {
  name: string;
  qty: number;
  customizations?: any;
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
    return;
  }

  // Format date in IST
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });

  const orderItemsHtml = orderItems.map(item => {
    let customText = "";
    if (item.customizations && typeof item.customizations === 'object') {
      const keys = Object.keys(item.customizations);
      if (keys.length > 0) {
         customText = ` <span style="color: #666; font-size: 0.9em;">(${keys.map(k => item.customizations[k]).join(', ')})</span>`;
      }
    }
    return `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          ${item.qty}x ${item.name}${customText}
        </td>
      </tr>
    `;
  }).join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; color: #111827; font-size: 24px;">🍽️ New Order Received</h2>
        <p style="margin: 8px 0 0; color: #4b5563; font-size: 16px;">${restaurantName} — ${tableName}</p>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${timestamp}</p>
      </div>
      
      <div style="padding: 24px;">
        <h3 style="margin: 0 0 16px; color: #374151; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          ${orderItemsHtml}
        </table>
        
        <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 6px; overflow: hidden;">
          <tr>
            <td style="padding: 12px 16px; color: #4b5563;">Subtotal</td>
            <td style="padding: 12px 16px; text-align: right; color: #111827;">₹${subtotal.toFixed(2)}</td>
          </tr>
          ${discount > 0 ? `
          <tr>
            <td style="padding: 12px 16px; color: #4b5563; border-top: 1px solid #e5e7eb;">Discount</td>
            <td style="padding: 12px 16px; text-align: right; color: #ef4444;">-₹${discount.toFixed(2)}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding: 12px 16px; font-weight: bold; color: #111827; border-top: 1px solid #e5e7eb; font-size: 18px;">TOTAL</td>
            <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #111827; border-top: 1px solid #e5e7eb; font-size: 18px;">₹${total.toFixed(2)}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">Order ID: ${orderId}</p>
        <p style="margin: 4px 0 0; color: #9ca3af; font-size: 12px;">Powered by TableMind</p>
      </div>
    </div>
  `;

  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ownerEmail,
      subject: `🍽️ New Order — ${tableName} at ${restaurantName}`,
      html: html
    });
    console.log("Email sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Failed to send order notification email:", error);
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

  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });

  const orderItemsHtml = orderItems.map(item => {
    let customText = "";
    if (item.customizations && typeof item.customizations === 'object') {
      const keys = Object.keys(item.customizations);
      if (keys.length > 0) {
         customText = ` <span style="color: #666; font-size: 0.9em;">(${keys.map(k => item.customizations[k]).join(', ')})</span>`;
      }
    } else if (typeof item.customizations === 'string') {
       customText = ` <span style="color: #666; font-size: 0.9em;">(${item.customizations})</span>`;
    }
    
    return `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          ${item.qty}x ${item.name}${customText}
        </td>
      </tr>
    `;
  }).join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; color: #111827; font-size: 24px;">Thank you for dining with us! 🍽️</h2>
        <p style="margin: 8px 0 0; color: #4b5563; font-size: 16px;">${restaurantName} — ${tableName}</p>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${timestamp}</p>
      </div>
      
      <div style="padding: 24px;">
        <h3 style="margin: 0 0 16px; color: #374151; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Your Order</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          ${orderItemsHtml}
        </table>
        
        <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 6px; overflow: hidden;">
          <tr>
            <td style="padding: 12px 16px; color: #4b5563;">Subtotal</td>
            <td style="padding: 12px 16px; text-align: right; color: #111827;">₹${subtotal.toFixed(2)}</td>
          </tr>
          ${discount > 0 ? `
          <tr>
            <td style="padding: 12px 16px; color: #4b5563; border-top: 1px solid #e5e7eb;">Discount</td>
            <td style="padding: 12px 16px; text-align: right; color: #ef4444;">-₹${discount.toFixed(2)}</td>
          </tr>
          ` : ""}
          ${creditsApplied > 0 ? `
          <tr>
            <td style="padding: 12px 16px; color: #4b5563; border-top: 1px solid #e5e7eb;">Credits Applied</td>
            <td style="padding: 12px 16px; text-align: right; color: #ef4444;">-₹${creditsApplied.toFixed(2)}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding: 12px 16px; color: #4b5563; border-top: 1px solid #e5e7eb;">Tax</td>
            <td style="padding: 12px 16px; text-align: right; color: #111827;">₹${tax.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-weight: bold; color: #111827; border-top: 1px solid #e5e7eb; font-size: 18px;">TOTAL PAID</td>
            <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #111827; border-top: 1px solid #e5e7eb; font-size: 18px;">₹${total.toFixed(2)}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">Order ID: ${orderId}</p>
        <p style="margin: 4px 0 0; color: #9ca3af; font-size: 12px;">Powered by TableMind</p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: guestEmail,
      subject: `Your receipt from ${restaurantName} 🧾`,
      html,
    });
  } catch (error) {
    console.error("Failed to send guest receipt email via Resend:", error);
  }
}
