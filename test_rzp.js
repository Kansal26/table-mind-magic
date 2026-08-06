import Razorpay from "razorpay";
const razorpay = new Razorpay({
  key_id: "rzp_test_TMWvbmY7wXFQ2o",
  key_secret: "k5otEmjqgKI5JrQzn2V1E581",
});

razorpay.orders.create({
  amount: 100,
  currency: "INR",
  receipt: "receipt_1",
}).then(console.log).catch(console.error);
