import { BrevoClient } from "@getbrevo/brevo";

const getBrevoClient = () => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is missing.");
  }

  return new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
  });
};

const getSender = () => {
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL is missing.");
  }

  return {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME || "StudyFluxAI",
  };
};

export const sendVerificationEmail = async ({
  email,
  fullName,
  otp,
}) => {
  const brevo = getBrevoClient();

  await brevo.transactionalEmails.sendTransacEmail({
    sender: getSender(),

    to: [
      {
        email,
        name: fullName,
      },
    ],

    subject: `${otp} is your StudyFluxAI verification code`,

    htmlContent: `
      <!DOCTYPE html>
      <html>
        <body style="
          margin:0;
          padding:0;
          background:#f7f8fc;
          font-family:Arial,Helvetica,sans-serif;
          color:#111827;
        ">
          <div style="padding:32px 16px;">
            <div style="
              max-width:560px;
              margin:0 auto;
              background:#ffffff;
              border:1px solid #e5e7eb;
              border-radius:20px;
              padding:36px;
            ">
              <h1 style="
                margin:0 0 12px;
                font-size:24px;
                color:#111827;
              ">
                Verify your StudyFluxAI account
              </h1>

              <p style="
                margin:0 0 24px;
                color:#64748b;
                line-height:1.6;
              ">
                Hi ${fullName}, use the verification code below to finish
                creating your StudyFluxAI account.
              </p>

              <div style="
                margin:24px 0;
                padding:18px;
                background:#eef2ff;
                border-radius:14px;
                text-align:center;
                font-size:32px;
                font-weight:700;
                letter-spacing:8px;
                color:#4f46e5;
              ">
                ${otp}
              </div>

              <p style="
                margin:0;
                color:#64748b;
                font-size:14px;
                line-height:1.6;
              ">
                This code expires in 10 minutes. If you did not request this,
                you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
};

export const sendFluxGemPurchaseReceipt = async ({
  email,
  fullName,
  gems,
  amountPaise,
  currency = "INR",
  razorpayOrderId,
  razorpayPaymentId,
}) => {
  const brevo = getBrevoClient();
  const amount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: Number(amountPaise) % 100 === 0 ? 0 : 2,
  }).format(Number(amountPaise) / 100);

  await brevo.transactionalEmails.sendTransacEmail({
    sender: getSender(),
    to: [
      {
        email,
        name: fullName,
      },
    ],
    subject: `Your StudyFluxAI FluxGem purchase receipt`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:#f7f8fc;font-family:Arial,Helvetica,sans-serif;color:#111827;">
          <div style="padding:32px 16px;">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;padding:36px;">
              <p style="margin:0 0 8px;color:#059669;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Payment verified</p>
              <h1 style="margin:0 0 12px;font-size:24px;color:#111827;">${gems} FluxGems added</h1>
              <p style="margin:0 0 24px;color:#64748b;line-height:1.6;">Hi ${fullName}, your Razorpay payment was verified and your StudyFluxAI wallet has been credited.</p>
              <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:18px;">
                <p style="margin:0 0 8px;font-weight:700;color:#065f46;">${gems} FluxGems · ${amount}</p>
                <p style="margin:0 0 6px;color:#475569;font-size:13px;word-break:break-all;">Payment ID: ${razorpayPaymentId}</p>
                <p style="margin:0;color:#475569;font-size:13px;word-break:break-all;">Order ID: ${razorpayOrderId}</p>
              </div>
              <p style="margin:22px 0 0;color:#64748b;font-size:13px;line-height:1.6;">You can also view this purchase in your StudyFluxAI profile history.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
};
