// Import dependencies
import { brevoTransacApi, brevoSender } from './brevo.client.js';
import { SendSmtpEmail } from '@getbrevo/brevo';
import { businessApprovedTemplate, businessRejectedTemplate, passwordResetTemplate, otpTemplate } from './templates.js';
import { logger } from '../utils/logger.js';

// Explicit type for recipient(s) -- Brevo expects: { email: string }[]
type SmtpRecipient = { email: string; name?: string };
type SendEmailInput = {
  to: SmtpRecipient[];
  subject: string;
  htmlContent: string;
};

async function send(input: SendEmailInput) {
  try {
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.sender = brevoSender;
    sendSmtpEmail.to = input.to as any;
    sendSmtpEmail.subject = input.subject as any;
    sendSmtpEmail.htmlContent = input.htmlContent as any;
    await brevoTransacApi.sendTransacEmail(sendSmtpEmail);
    logger.info('[Email] Sent email:', input.subject, input.to.map(t => t.email).join(','));
  } catch (err) {
    logger.error('[Email] Failed to send', err);
    throw err;
  }
}

export const emailService = {
  async sendBusinessApproved(toEmail: string, businessName: string, dashboardUrl: string) {
    const html = businessApprovedTemplate({ businessName, dashboardUrl });
    return send({
      to: [{ email: toEmail }],
      subject: `Your business "${businessName}" is approved`,
      htmlContent: html,
    });
  },
  async sendBusinessRejected(toEmail: string, businessName: string, reason: string | undefined, helpUrl: string) {
    const templateData: { businessName: string; helpUrl: string; reason?: string } = { businessName, helpUrl };
    if (typeof reason !== 'undefined') templateData.reason = reason;
    const html = businessRejectedTemplate(templateData);
    return send({
      to: [{ email: toEmail }],
      subject: `Update on "${businessName}" application`,
      htmlContent: html,
    });
  },
  async sendBusinessApplicationReceived(toEmail: string, businessName: string) {
    // Import dynamically to avoid circular dependency if any, or just use the imported one
    // Assuming template is imported at top
    const html = require('./templates.js').businessApplicationReceivedTemplate({ businessName });
    return send({
      to: [{ email: toEmail }],
      subject: `Application received for "${businessName}"`,
      htmlContent: html,
    });
  },
  async sendPasswordReset(toEmail: string, resetUrl: string) {
    const html = passwordResetTemplate({ resetUrl });
    return send({
      to: [{ email: toEmail }],
      subject: 'Reset your password',
      htmlContent: html,
    });
  },
  async sendOtp(toEmail: string, otp: string) {
    const html = otpTemplate({ otp });
    return send({
      to: [{ email: toEmail }],
      subject: 'Your verification code',
      htmlContent: html,
    });
  },
};
