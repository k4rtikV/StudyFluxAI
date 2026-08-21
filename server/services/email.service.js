import { BrevoClient } from "@getbrevo/brevo";

const getBrevoClient = () => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is missing.");
  }

  return new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
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

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const paragraphHtml = (value) => escapeHtml(value).replace(/\r?\n/g, "<br />");

const getClientBase = () => String(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

const safeClientHref = (path = "") => {
  const safePath = String(path || "").startsWith("/") ? path : "";
  return `${getClientBase()}${safePath}`;
};

const actionButton = ({ href, label }) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;">
    <tr>
      <td style="border-radius:12px;background:#6d28d9;">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:linear-gradient(90deg,#7c3aed,#2563eb,#06b6d4,#10b981);color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;line-height:1;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>
`;

const infoPanel = ({ html, tone = "violet" }) => {
  const tones = {
    violet: ["#f5f3ff", "#ddd6fe", "#5b21b6"],
    cyan: ["#ecfeff", "#a5f3fc", "#0e7490"],
    emerald: ["#ecfdf5", "#a7f3d0", "#047857"],
    amber: ["#fffbeb", "#fde68a", "#b45309"],
    slate: ["#f8fafc", "#e2e8f0", "#475569"],
  };
  const [background, border, color] = tones[tone] || tones.violet;
  return `<div style="margin:20px 0 0;padding:16px 18px;border:1px solid ${border};border-radius:14px;background:${background};color:${color};font-size:14px;line-height:1.7;">${html}</div>`;
};

const buildBrandedEmail = ({
  preheader = "StudyFluxAI update",
  eyebrow = "StudyFluxAI",
  title,
  greeting = "",
  bodyHtml = "",
  footer = "This is an automated StudyFluxAI message.",
}) => `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f7fb;">
      <tr>
        <td align="center" style="padding:34px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;border-collapse:separate;background:#ffffff;border:1px solid #dbe4f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,.08);">
            <tr><td style="height:6px;background:linear-gradient(90deg,#7c3aed,#2563eb,#06b6d4,#10b981);font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:28px 32px 12px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:12px;">
                      <div style="width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#7c3aed,#2563eb 48%,#06b6d4 72%,#10b981);color:#ffffff;font-size:23px;font-weight:900;line-height:42px;text-align:center;box-shadow:0 7px 20px rgba(79,70,229,.25);">S</div>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:19px;font-weight:900;letter-spacing:-.02em;color:#0f172a;">Study<span style="color:#4f46e5;">FluxAI</span></div>
                      <div style="margin-top:2px;font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#94a3b8;">Learning Workspace</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 34px;">
                <div style="font-size:11px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#6d28d9;">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:9px 0 0;font-size:27px;line-height:1.25;letter-spacing:-.035em;color:#0f172a;">${escapeHtml(title)}</h1>
                ${greeting ? `<p style="margin:15px 0 0;font-size:15px;line-height:1.75;color:#64748b;">${greeting}</p>` : ""}
                <div style="margin-top:18px;font-size:15px;line-height:1.78;color:#475569;">${bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px;border-top:1px solid #eef2f7;background:#fbfdff;color:#94a3b8;font-size:11px;line-height:1.6;">
                ${escapeHtml(footer)}<br />
                <span style="color:#64748b;font-weight:700;">StudyFluxAI</span> · Learn smarter. Progress deliberately.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const sendHtmlEmail = async ({ to, subject, htmlContent, replyTo }) => {
  const brevo = getBrevoClient();
  return brevo.transactionalEmails.sendTransacEmail({
    sender: getSender(),
    to,
    subject,
    htmlContent,
    ...(replyTo ? { replyTo } : {}),
  });
};

export const sendVerificationEmail = async ({ email, fullName, otp }) =>
  sendHtmlEmail({
    to: [{ email, name: fullName }],
    subject: `${otp} is your StudyFluxAI verification code`,
    htmlContent: buildBrandedEmail({
      preheader: `Your StudyFluxAI verification code is ${otp}`,
      eyebrow: "Verify your email",
      title: "Finish creating your account",
      greeting: `Hi ${escapeHtml(fullName)}, verify this email address to activate your StudyFluxAI account.`,
      bodyHtml: `
        ${infoPanel({
          tone: "violet",
          html: `<div style="text-align:center;"><div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Verification code</div><div style="margin-top:6px;font-size:34px;font-weight:900;letter-spacing:8px;color:#4f46e5;">${escapeHtml(otp)}</div></div>`,
        })}
        <p style="margin:18px 0 0;">This code expires in 10 minutes and can be used only once. If you did not start a StudyFluxAI registration, ignore this email.</p>
      `,
      footer: "Never share verification codes, passwords, or payment secrets with anyone claiming to be StudyFluxAI support.",
    }),
  });

export const sendPasswordResetEmail = async ({ email, fullName, otp }) =>
  sendHtmlEmail({
    to: [{ email, name: fullName }],
    subject: `${otp} is your StudyFluxAI password reset code`,
    htmlContent: buildBrandedEmail({
      preheader: `Use ${otp} to reset your StudyFluxAI password`,
      eyebrow: "Account security",
      title: "Reset your password",
      greeting: `Hi ${escapeHtml(fullName)}, we received a request to reset your StudyFluxAI password.`,
      bodyHtml: `
        ${infoPanel({
          tone: "amber",
          html: `<div style="text-align:center;"><div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Password reset code</div><div style="margin-top:6px;font-size:34px;font-weight:900;letter-spacing:8px;color:#b45309;">${escapeHtml(otp)}</div></div>`,
        })}
        <p style="margin:18px 0 0;">Enter this code on the StudyFluxAI reset-password screen. It expires in 10 minutes and can be used only once.</p>
        ${actionButton({ href: safeClientHref("/reset-password"), label: "Reset password" })}
        <p style="margin:18px 0 0;font-weight:700;color:#334155;">If you did not request a password reset, do nothing. Your password remains unchanged.</p>
      `,
      footer: "StudyFluxAI will never ask you to send a password or reset code by email, chat, or support request.",
    }),
  });

export const sendSecurityAlertEmail = async ({
  email,
  fullName,
  title,
  message,
}) =>
  sendHtmlEmail({
    to: [{ email, name: fullName }],
    subject: `StudyFluxAI security: ${String(title || "account change").slice(0, 120)}`,
    htmlContent: buildBrandedEmail({
      preheader: "A security-sensitive change was made to your StudyFluxAI account",
      eyebrow: "Security notice",
      title,
      greeting: `Hi ${escapeHtml(fullName || "there")},`,
      bodyHtml: `${infoPanel({ tone: "slate", html: paragraphHtml(message) })}<p style="margin:18px 0 0;">If you made this change, no action is needed. If you did not, secure your email account and contact StudyFluxAI support.</p>`,
      footer: "Security notices are transactional and are sent regardless of optional email preferences.",
    }),
  });

export const sendFluxGemPurchaseReceipt = async ({
  email,
  fullName,
  gems,
  amountPaise,
  currency = "INR",
  razorpayOrderId,
  razorpayPaymentId,
}) => {
  const amount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: Number(amountPaise) % 100 === 0 ? 0 : 2,
  }).format(Number(amountPaise) / 100);

  return sendHtmlEmail({
    to: [{ email, name: fullName }],
    subject: "Your StudyFluxAI FluxGem purchase receipt",
    htmlContent: buildBrandedEmail({
      preheader: `${gems} FluxGems were added to your StudyFluxAI wallet`,
      eyebrow: "Payment verified",
      title: `${gems} FluxGems added`,
      greeting: `Hi ${escapeHtml(fullName)}, your Razorpay payment was verified and your StudyFluxAI wallet was credited.`,
      bodyHtml: `
        ${infoPanel({
          tone: "emerald",
          html: `<strong style="font-size:17px;">${escapeHtml(gems)} FluxGems · ${escapeHtml(amount)}</strong><br /><span style="font-size:12px;word-break:break-all;">Payment ID: ${escapeHtml(razorpayPaymentId)}</span><br /><span style="font-size:12px;word-break:break-all;">Order ID: ${escapeHtml(razorpayOrderId)}</span>`,
        })}
        <p style="margin:18px 0 0;">You can review this purchase in your StudyFluxAI profile and FluxGem activity history.</p>
        ${actionButton({ href: safeClientHref("/profile"), label: "View profile" })}
      `,
      footer: "Keep this receipt for your records. Payment and verification emails cannot be disabled in optional email preferences.",
    }),
  });
};

export const sendNotificationEmail = async ({
  email,
  fullName,
  title,
  body,
  actionUrl = "",
  actionLabel = "Open StudyFluxAI",
}) => {
  const actionHref = safeClientHref(actionUrl);

  return sendHtmlEmail({
    to: [{ email, name: fullName }],
    subject: `${String(title || "StudyFluxAI update").slice(0, 160)}`,
    htmlContent: buildBrandedEmail({
      preheader: body,
      eyebrow: "StudyFluxAI update",
      title: title || "StudyFluxAI update",
      greeting: `Hi ${escapeHtml(fullName || "there")},`,
      bodyHtml: `<div>${paragraphHtml(body)}</div>${actionButton({ href: actionHref, label: actionLabel || "Open StudyFluxAI" })}`,
      footer: "You can manage optional announcement, community, and reward emails from StudyFluxAI Settings.",
    }),
  });
};

export const sendStudyPlanReminderEmail = async ({
  email,
  fullName,
  timezone,
  title,
  topic,
  goal,
  targetAt,
  durationMinutes,
  priority,
}) => {
  const target = new Date(targetAt);
  let deadline = target.toISOString();
  try {
    deadline = new Intl.DateTimeFormat("en", {
      timeZone: timezone || "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(target);
  } catch {
    deadline = target.toUTCString();
  }

  const duration = Number(durationMinutes || 0);
  const durationLabel = duration > 0
    ? `${duration} minute${duration === 1 ? "" : "s"}`
    : "Not specified";

  return sendHtmlEmail({
    to: [{ email, name: fullName }],
    subject: `Study plan reminder: ${String(title || topic || "your deadline").slice(0, 110)} is one week away`,
    htmlContent: buildBrandedEmail({
      preheader: `${String(title || topic || "Your study plan")} is due in one week`,
      eyebrow: "Study Planner reminder",
      title: "Your study deadline is one week away",
      greeting: `Hi ${escapeHtml(fullName || "there")}, this active Study Planner goal is due in seven days.`,
      bodyHtml: `
        ${infoPanel({
          tone: priority === "high" ? "amber" : "violet",
          html: `<strong style="font-size:17px;">${escapeHtml(title || topic || "Study plan")}</strong><br />${topic ? `<span style="color:#64748b;">${escapeHtml(topic)}</span><br />` : ""}<div style="margin-top:10px;"><strong>Deadline:</strong> ${escapeHtml(deadline)}<br /><strong>Priority:</strong> ${escapeHtml(priority || "medium")}<br /><strong>Planned study time:</strong> ${escapeHtml(durationLabel)}</div>`,
        })}
        ${goal ? `<div style="margin-top:18px;"><strong style="color:#334155;">Goal</strong><div style="margin-top:5px;">${paragraphHtml(goal)}</div></div>` : ""}
        <p style="margin:18px 0 0;">Open Study Planner to review linked material, adjust the schedule, or mark the plan complete when you are done.</p>
        ${actionButton({ href: safeClientHref("/planner"), label: "Open Study Planner" })}
      `,
      footer: "This one-week reminder is sent only while the plan is still active. You can turn Study plan reminders off in StudyFluxAI Settings.",
    }),
  });
};

export const sendSupportRequestEmail = async ({
  supportEmail,
  userEmail,
  fullName,
  category,
  subject,
  message,
  requestId,
}) =>
  sendHtmlEmail({
    to: [{ email: supportEmail, name: "StudyFluxAI Support" }],
    replyTo: { email: userEmail, name: fullName },
    subject: `[Support · ${String(category || "other")}] ${String(subject || "StudyFluxAI request").slice(0, 140)}`,
    htmlContent: buildBrandedEmail({
      preheader: `New learner support request from ${fullName}`,
      eyebrow: "Learner support request",
      title: subject || "StudyFluxAI support request",
      bodyHtml: `
        ${infoPanel({
          tone: "cyan",
          html: `<strong>${escapeHtml(fullName)}</strong> · ${escapeHtml(userEmail)}<br />Category: ${escapeHtml(category)}<br />Request ID: ${escapeHtml(requestId)}`,
        })}
        <div style="margin-top:18px;">${paragraphHtml(message)}</div>
      `,
      footer: "Reply to this email to respond directly to the learner. Never request passwords, OTPs, or payment secrets.",
    }),
  });

export const sendSupportConfirmationEmail = async ({ email, fullName, subject, requestId }) =>
  sendHtmlEmail({
    to: [{ email, name: fullName }],
    subject: "We received your StudyFluxAI support request",
    htmlContent: buildBrandedEmail({
      preheader: "Your StudyFluxAI support request was received",
      eyebrow: "Support request received",
      title: "We have your message",
      greeting: `Hi ${escapeHtml(fullName)}, your request about ${escapeHtml(subject)} was submitted to StudyFluxAI support.`,
      bodyHtml: `${infoPanel({ tone: "emerald", html: `<strong>Reference:</strong> ${escapeHtml(requestId)}` })}<p style="margin:18px 0 0;">Keep this reference if you need to follow up.</p>`,
      footer: "StudyFluxAI support will never ask for your password, verification code, or payment secret.",
    }),
  });
