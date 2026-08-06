import { sendNewOrderNotification } from "./src/lib/email.server.js";
import { config } from "dotenv";

config();

async function test() {
  console.log("Testing email sending...");
  await sendNewOrderNotification({
    restaurantName: "Test Restaurant",
    tableName: "Test Table 1",
    orderItems: [
      { name: "Butter Chicken", qty: 2 },
      { name: "Dal Makhani", qty: 1, customizations: { "spice": "high" } }
    ],
    subtotal: 1020,
    discount: 0,
    total: 1020,
    ownerEmail: process.env.RESTAURANT_NOTIFICATION_EMAIL || "test@example.com",
    orderId: "test-order-12345"
  });
}

test();
