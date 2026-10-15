import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import razorpay from "../services/razorpay.service.js";
import crypto from "crypto"
import { getPlan } from "../config/plans.js";

export const createOrder = async (req,res) => {
    try {
        const { planId } = req.body;
        const plan = getPlan(planId);
        if (!plan) return res.status(400).json({ message: "Invalid plan." });

    const demoMode = process.env.PAYMENT_MODE === "demo" && process.env.NODE_ENV !== "production";
    if (demoMode) {
      const demoOrderId = `order_demo_${Date.now()}`;

      await Payment.create({
        userId: req.userId,
        planId,
        amount: plan.amount,
        credits: plan.credits,
        razorpayOrderId: demoOrderId,
        status: "created",
      });

      return res.json({
        id: demoOrderId,
        amount: plan.amount * 100,
        currency: "INR",
        demo: true,
      });
    }

    if (!razorpay) {
      return res.status(503).json({ message: "Payments are not configured." });
    }

     const options = {
      amount: plan.amount * 100, // convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options)

     await Payment.create({
      userId: req.userId,
      planId,
      amount: plan.amount,
      credits: plan.credits,
      razorpayOrderId: order.id,
      status: "created",
    });

    return res.json(order);

    
    } catch (error) {
         console.error("Failed to create payment order:", error.message);
         return res.status(500).json({message:"Could not create a payment order."})
    }
}


export const verifyPayment = async (req,res) => {
    try {
        const {razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature} = req.body

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      userId: req.userId,
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const demoMode = process.env.PAYMENT_MODE === "demo" && process.env.NODE_ENV !== "production";
    if (demoMode && razorpay_order_id?.startsWith("order_demo_")) {
      const claimedPayment = await Payment.findOneAndUpdate(
        { _id: payment._id, status: "created" },
        { $set: { status: "paid", razorpayPaymentId: razorpay_payment_id || `pay_demo_${Date.now()}` } },
        { new: true }
      );
      if (!claimedPayment) return res.status(409).json({ message: "This payment was already processed." });
      const updatedUser = await User.findByIdAndUpdate(payment.userId, { $inc: { credits: payment.credits } }, { new: true });
      return res.json({ success: true, demo: true, message: "Demo payment processed and credits added", user: updatedUser });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ message: "Razorpay keys are not configured" });
    }

      const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(razorpay_signature || "");
    if (!razorpay_signature || expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const claimedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "created" },
      { $set: { status: "paid", razorpayPaymentId: razorpay_payment_id } },
      { new: true }
    );
    if (!claimedPayment) return res.status(409).json({ message: "This payment was already processed." });

    // Add credits to user
    const updatedUser = await User.findByIdAndUpdate(payment.userId, {
      $inc: { credits: payment.credits }
    },{new:true});

    res.json({
      success: true,
      message: "Payment verified and credits added",
      user: updatedUser,
    });

    } catch (error) {
         console.error("Failed to verify payment:", error.message);
         return res.status(500).json({message:"Could not verify the payment."})
    }
}
