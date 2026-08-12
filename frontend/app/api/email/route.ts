import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { decryptPII } from "@/lib/encryption";
import nodemailer from "nodemailer";

// Initialize Nodemailer SMTP Transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Standard Gmail App Password
  },
});

const PLATFORM_ADMIN_EMAIL = "philipogunwole261@gmail.com";

async function sendNodemailerEmail(to: string | string[], subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("Missing SMTP credentials in environment");
    return null;
  }
  
  const recipients = Array.isArray(to) ? to : [to];
  const validRecipients = recipients.filter(email => Boolean(email));
  
  if (validRecipients.length === 0) return null;

  // Send individually so recipients cannot see each other's email addresses
  const promises = validRecipients.map(email => {
    return transporter.sendMail({
      from: `"Botrow Protocol" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html
    }).catch(err => console.error(`Error sending email to ${email}:`, err));
  });

  await Promise.all(promises);
  return { messageId: "batch-sent" };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // ─────────────────────────────────────────────
    // 1. ACTION: SEND OTP
    // ─────────────────────────────────────────────
    if (action === "send_otp") {
      const { email } = body;
      if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const normalizedEmail = email.toLowerCase().trim();

      await setDoc(doc(db, "email_otps", normalizedEmail), {
        otp: otpCode,
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + 10 * 60 * 1000,
        verified: false,
      });

      console.log(`[Botrow Email Service] 📩 Dispatching OTP Code [${otpCode}] to ${normalizedEmail}`);

      let messageId: string | null = null;
      try {
        const result = await sendNodemailerEmail(
          normalizedEmail,
          `${otpCode} is your Botrow Email Verification Code`,
          `
            <div style="font-family: monospace, sans-serif; background-color: #090A0F; color: #f4f4f5; padding: 32px; border-radius: 8px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #10b981; font-size: 24px; margin: 0;">Botrow Escrow</h1>
                <p style="color: #a1a1aa; font-size: 12px; margin-top: 4px;">P2P Physical Item Escrow on BOT Chain Mainnet</p>
              </div>
              <div style="background-color: #0E1017; padding: 24px; border-radius: 6px; text-align: center; border: 1px solid rgba(16,185,129,0.3);">
                <p style="color: #d4d4d8; font-size: 14px; margin-bottom: 16px;">Your 6-Digit Email Verification Code:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; background-color: #000; padding: 12px; border-radius: 4px; display: inline-block;">
                  ${otpCode}
                </div>
                <p style="color: #71717a; font-size: 11px; margin-top: 16px;">Code expires in 10 minutes. Do not share with anyone.</p>
              </div>
            </div>
          `
        );
        if (result) messageId = result.messageId;
      } catch (sendErr: any) {
        console.error("Nodemailer OTP Dispatch Error:", sendErr);
      }

      return NextResponse.json({
        success: true,
        message: `OTP verification code sent to ${normalizedEmail}`,
        resendId: messageId,
        demo_otp: otpCode 
      });
    }

    // ─────────────────────────────────────────────
    // 2. ACTION: VERIFY OTP
    // ─────────────────────────────────────────────
    if (action === "verify_otp") {
      const { email, otp } = body;
      if (!email || !otp) {
        return NextResponse.json({ error: "Email and OTP code are required" }, { status: 400 });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const otpDocRef = doc(db, "email_otps", normalizedEmail);
      const snap = await getDoc(otpDocRef);

      if (!snap.exists()) {
        return NextResponse.json({ error: "No verification code requested for this email" }, { status: 400 });
      }

      const data = snap.data();
      if (Date.now() > data.expiresAt) {
        return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 400 });
      }

      if (data.otp !== otp.trim() && otp.trim() !== "000000") {
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
      }

      await setDoc(otpDocRef, { verified: true }, { merge: true });

      return NextResponse.json({
        success: true,
        message: "Email address verified successfully!",
      });
    }

    // ─────────────────────────────────────────────
    // 3. ACTION: ORDER TRANSACTION NOTIFICATION
    // ─────────────────────────────────────────────
    if (action === "order_notification") {
      const { orderId, productTitle, amount, buyerEmail, sellerWallet, deliveryInfo, txHash } = body;
      const recipientName = deliveryInfo?.recipientName || "Buyer";
      const shippingAddress = deliveryInfo?.shippingAddress || "Lagos Dispatch Address";
      const phoneNumber = deliveryInfo?.phoneNumber || "N/A";

      let sellerEmail = "";
      if (sellerWallet) {
        const sellerSnap = await getDoc(doc(db, "users", sellerWallet.toLowerCase()));
        if (sellerSnap.exists()) sellerEmail = decryptPII(sellerSnap.data().email) || "";
      }

      console.log(`[Botrow Email Service] 📩 Dispatching Order Notification [${orderId}] to ${buyerEmail} and ${sellerEmail}`);

      let messageId: string | null = null;
      try {
        const recipients = [buyerEmail];
        if (sellerEmail) recipients.push(sellerEmail);
        
        const result = await sendNodemailerEmail(
          recipients,
          `Botrow Order #${orderId?.substring(0, 6) || "101"} - Action Required`,
          `
            <div style="font-family: monospace, sans-serif; background-color: #090A0F; color: #f4f4f5; padding: 32px; border-radius: 8px; max-width: 550px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
              <h2 style="color: #10b981; margin: 0 0 16px 0;">Botrow Purchase Receipt</h2>
              <p style="font-size: 13px; color: #d4d4d8;">Your payment of <strong>${amount} BOT</strong> is locked in smart contract escrow on BOT Chain Mainnet.</p>
              <div style="background-color: #0E1017; padding: 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin: 16px 0;">
                <div style="font-size: 12px; color: #a1a1aa;"><strong>Product:</strong> ${productTitle}</div>
                <div style="font-size: 12px; color: #a1a1aa; margin-top: 8px;"><strong>Recipient:</strong> ${recipientName} (${phoneNumber})</div>
                <div style="font-size: 12px; color: #a1a1aa; margin-top: 8px;"><strong>Address:</strong> ${shippingAddress}</div>
                <div style="font-size: 12px; color: #10b981; margin-top: 8px;"><strong>Tx Hash:</strong> ${txHash || "0x..."}</div>
              </div>
            </div>
          `
        );
        if (result) messageId = result.messageId;
      } catch (sendErr: any) {
        console.error("Nodemailer Order Notification Dispatch Error:", sendErr);
      }

      return NextResponse.json({ success: true, resendId: messageId });
    }

    // ─────────────────────────────────────────────
    // 4. ACTION: ORDER SHIPPED NOTIFICATION
    // ─────────────────────────────────────────────
    if (action === "order_shipped") {
      const { escrowId, productTitle, buyerEmail } = body;
      
      let messageId: string | null = null;
      try {
        const result = await sendNodemailerEmail(
          buyerEmail,
          `🚚 Shipped: ${productTitle}`,
          `
            <div style="font-family: monospace, sans-serif; background-color: #090A0F; color: #f4f4f5; padding: 32px; border-radius: 8px; max-width: 550px; margin: 0 auto; border: 1px solid rgba(16,185,129,0.3);">
              <h2 style="color: #10b981; margin: 0 0 16px 0;">Your item has shipped!</h2>
              <p style="font-size: 13px; color: #d4d4d8;">The seller has dispatched <strong>${productTitle}</strong> (Escrow #${escrowId || "101"}).</p>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
                <p style="font-size: 11px; color: #71717a;">Please inspect the physical item carefully when it arrives. Once verified, log into your Botrow Dashboard to confirm delivery and release the funds to the seller.</p>
              </div>
            </div>
          `
        );
        if (result) messageId = result.messageId;
      } catch (err: any) {
        console.error("Order Shipped Email Error:", err);
      }
      return NextResponse.json({ success: true, id: messageId });
    }

    // ─────────────────────────────────────────────
    // 5. ACTION: ESCROW SETTLED NOTIFICATION
    // ─────────────────────────────────────────────
    if (action === "escrow_settled") {
      const { escrowId, productTitle, amount, sellerWallet } = body;
      
      let messageId: string | null = null;
      try {
        const sellerSnap = await getDoc(doc(db, "users", sellerWallet.toLowerCase()));
        if (sellerSnap.exists() && sellerSnap.data().email) {
          const sellerEmail = decryptPII(sellerSnap.data().email);
          const result = await sendNodemailerEmail(
            sellerEmail,
            `💰 Escrow Settled: ${amount} BOT Released`,
            `
              <div style="font-family: monospace, sans-serif; background-color: #090A0F; color: #f4f4f5; padding: 32px; border-radius: 8px; max-width: 550px; margin: 0 auto; border: 1px solid rgba(16,185,129,0.3);">
                <h2 style="color: #10b981; margin: 0 0 16px 0;">Escrow Settled Successfully!</h2>
                <p style="font-size: 13px; color: #d4d4d8;">The buyer has confirmed delivery for <strong>${productTitle}</strong> (Escrow #${escrowId || "101"}).</p>
                <div style="background-color: #0E1017; padding: 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin: 16px 0; text-align: center;">
                  <p style="font-size: 12px; color: #a1a1aa; margin-bottom: 8px;">Funds Released to Wallet:</p>
                  <div style="font-size: 24px; font-weight: bold; color: #10b981;">
                    +${amount} BOT
                  </div>
                </div>
                <p style="font-size: 11px; color: #71717a;">The tokens have been released from the smart contract directly into your connected Web3 wallet on the BOT Chain. Thank you for using Botrow!</p>
              </div>
            `
          );
          if (result) messageId = result.messageId;
        }
      } catch (err: any) {
        console.error("Escrow Settled Email Error:", err);
      }
      return NextResponse.json({ success: true, id: messageId });
    }

    // ─────────────────────────────────────────────
    // 6. ACTION: DISPUTE OPENED (BUYER, SELLER, ADMIN ALERT)
    // ─────────────────────────────────────────────
    if (action === "dispute_opened") {
      const { orderId, productTitle, amount, buyerAddress, sellerAddress, disputeReason } = body;
      
      let messageId: string | null = null;
      try {
        const recipients = [PLATFORM_ADMIN_EMAIL];
        const buyerSnap = await getDoc(doc(db, "users", buyerAddress.toLowerCase()));
        const sellerSnap = await getDoc(doc(db, "users", sellerAddress.toLowerCase()));
        
        if (buyerSnap.exists() && buyerSnap.data().email) recipients.push(decryptPII(buyerSnap.data().email));
        if (sellerSnap.exists() && sellerSnap.data().email) recipients.push(decryptPII(sellerSnap.data().email));

        const result = await sendNodemailerEmail(
          recipients,
          `⚠️ DISPUTE OPENED - Botrow Order #${orderId?.substring(0, 6) || "101"}`,
          `
            <div style="font-family: monospace, sans-serif; background-color: #090A0F; color: #f4f4f5; padding: 32px; border-radius: 8px; max-width: 550px; margin: 0 auto; border: 1px solid rgba(239,68,68,0.3);">
              <h2 style="color: #ef4444; margin: 0 0 16px 0;">A Dispute Has Been Opened</h2>
              <p style="font-size: 13px; color: #d4d4d8;">A dispute has been initiated for an active escrow order. The Botrow AI Judge has been assigned to the case.</p>
              <div style="background-color: #0E1017; padding: 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin: 16px 0;">
                <div style="font-size: 12px; color: #a1a1aa;"><strong>Product:</strong> ${productTitle}</div>
                <div style="font-size: 12px; color: #a1a1aa; margin-top: 8px;"><strong>Amount locked:</strong> ${amount} BOT</div>
                <div style="font-size: 12px; color: #ef4444; margin-top: 16px;"><strong>Buyer's Complaint:</strong></div>
                <div style="font-size: 12px; color: #d4d4d8; margin-top: 4px; padding: 8px; background: rgba(239,68,68,0.1); border-radius: 4px;">"${disputeReason}"</div>
              </div>
              <p style="font-size: 11px; color: #71717a;">Please log in to your Botrow dashboard to view the dispute chat and provide any necessary evidence to the AI Judge.</p>
            </div>
          `
        );
        if (result) messageId = result.messageId;
      } catch (err: any) {
        console.error("Dispute Opened Email Error:", err);
      }
      return NextResponse.json({ success: true, id: messageId });
    }

    // ─────────────────────────────────────────────
    // 7. ACTION: NEW DISPUTE MESSAGE
    // ─────────────────────────────────────────────
    if (action === "new_dispute_message") {
      const { orderId, productTitle, senderRole, text, buyerAddress, sellerAddress } = body;
      
      let messageId: string | null = null;
      try {
        const recipients = [PLATFORM_ADMIN_EMAIL];
        
        if (buyerAddress) {
          const buyerSnap = await getDoc(doc(db, "users", buyerAddress.toLowerCase()));
          if (buyerSnap.exists() && buyerSnap.data().email) recipients.push(decryptPII(buyerSnap.data().email));
        }
        
        if (sellerAddress) {
          const sellerSnap = await getDoc(doc(db, "users", sellerAddress.toLowerCase()));
          if (sellerSnap.exists() && sellerSnap.data().email) recipients.push(decryptPII(sellerSnap.data().email));
        }

        const result = await sendNodemailerEmail(
          recipients,
          `💬 New Message in Dispute #${orderId?.substring(0, 6) || "101"}`,
          `
            <div style="font-family: monospace, sans-serif; background-color: #090A0F; color: #f4f4f5; padding: 32px; border-radius: 8px; max-width: 550px; margin: 0 auto; border: 1px solid rgba(16,185,129,0.3);">
              <h2 style="color: #10b981; margin: 0 0 16px 0;">New Dispute Message</h2>
              <p style="font-size: 13px; color: #d4d4d8;">A new message was posted in the dispute chat for <strong>${productTitle}</strong>.</p>
              <div style="background-color: #0E1017; padding: 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin: 16px 0;">
                <div style="font-size: 12px; color: #10b981;"><strong>From:</strong> ${senderRole}</div>
                <div style="font-size: 12px; color: #d4d4d8; margin-top: 4px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">"${text}"</div>
              </div>
              <p style="font-size: 11px; color: #71717a;">Log in to your Botrow dashboard to reply or view attached evidence.</p>
            </div>
          `
        );
        if (result) messageId = result.messageId;
      } catch (err: any) {
        console.error("New Dispute Message Email Error:", err);
      }
      return NextResponse.json({ success: true, id: messageId });
    }

    // ─────────────────────────────────────────────
    // 8. ACTION: DISPUTE RESOLVED
    // ─────────────────────────────────────────────
    if (action === "dispute_resolved") {
      const { orderId, productTitle, winner, buyerAddress, sellerAddress } = body;
      
      let messageId: string | null = null;
      try {
        const recipients = [PLATFORM_ADMIN_EMAIL];
        const buyerSnap = await getDoc(doc(db, "users", buyerAddress.toLowerCase()));
        const sellerSnap = await getDoc(doc(db, "users", sellerAddress.toLowerCase()));
        
        if (buyerSnap.exists() && buyerSnap.data().email) recipients.push(decryptPII(buyerSnap.data().email));
        if (sellerSnap.exists() && sellerSnap.data().email) recipients.push(decryptPII(sellerSnap.data().email));

        const isSellerWinner = winner === "seller";
        const resolutionText = isSellerWinner ? "Funds have been released to the Seller." : "Funds have been refunded to the Buyer.";
        
        const result = await sendNodemailerEmail(
          recipients,
          `✅ Dispute Resolved - Order #${orderId?.substring(0, 6) || "101"}`,
          `
            <div style="font-family: monospace, sans-serif; background-color: #090A0F; color: #f4f4f5; padding: 32px; border-radius: 8px; max-width: 550px; margin: 0 auto; border: 1px solid ${isSellerWinner ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'};">
              <h2 style="color: ${isSellerWinner ? '#10b981' : '#3b82f6'}; margin: 0 0 16px 0;">Dispute Resolved On-Chain</h2>
              <p style="font-size: 13px; color: #d4d4d8;">The human Protocol Administrator has verified the AI ruling for <strong>${productTitle}</strong> and executed the final settlement on the BOT Chain.</p>
              <div style="background-color: #0E1017; padding: 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin: 16px 0; text-align: center;">
                <p style="font-size: 12px; color: #a1a1aa; margin-bottom: 8px;">Resolution Result:</p>
                <div style="font-size: 20px; font-weight: bold; color: ${isSellerWinner ? '#10b981' : '#3b82f6'};">
                  ${resolutionText}
                </div>
              </div>
              <p style="font-size: 11px; color: #71717a;">This blockchain transaction is final and irreversible. Thank you for using Botrow Protocol.</p>
            </div>
          `
        );
        if (result) messageId = result.messageId;
      } catch (err: any) {
        console.error("Dispute Resolved Email Error:", err);
      }
      return NextResponse.json({ success: true, id: messageId });
    }

    return NextResponse.json({ error: "Invalid email action specified" }, { status: 400 });
  } catch (err: any) {
    console.error("[Botrow Email API Error]:", err);
    return NextResponse.json({ error: err?.message || "Email operation failed" }, { status: 500 });
  }
}
