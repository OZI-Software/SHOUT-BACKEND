const baseStyles = `
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #ffffff;
`;

const headerStyle = `
  text-align: center;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
  margin-bottom: 30px;
`;

const logoStyle = `
  font-size: 24px;
  font-weight: bold;
  color: #f97316; /* Primary Orange */
  text-decoration: none;
  letter-spacing: -0.5px;
`;

const buttonStyle = `
  display: inline-block;
  padding: 12px 24px;
  background-color: #f97316;
  color: #ffffff;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  margin-top: 20px;
  margin-bottom: 20px;
`;

const footerStyle = `
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  text-align: center;
  font-size: 12px;
  color: #888;
`;

function wrapTemplate(content: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f9fafb;">
      <div style="padding: 40px 0;">
        <div style="${baseStyles}">
          <div style="${headerStyle}">
            <a href="#" style="${logoStyle}">SHOUT</a>
          </div>
          ${content}
          <div style="${footerStyle}">
            <p>&copy; ${new Date().getFullYear()} SHOUT. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function businessApprovedTemplate(data: { businessName: string; dashboardUrl: string }) {
  const content = `
    <h2 style="margin: 0 0 20px; font-size: 24px; color: #111;">Your business is approved! 🎉</h2>
    <p style="margin-bottom: 16px;">Hi there,</p>
    <p style="margin-bottom: 16px;">Great news! Your business <strong>${data.businessName}</strong> has been verified and approved on SHOUT.</p>
    <p style="margin-bottom: 24px;">To get started, please set your password and log in to your dashboard.</p>
    <div style="text-align: center;">
      <a href="${data.dashboardUrl}" style="${buttonStyle}">Set Password & Login</a>
    </div>
    <p style="margin-top: 24px; color: #555;">We're excited to have you on board!</p>
  `;
  return wrapTemplate(content);
}

export function businessRejectedTemplate(data: { businessName: string; reason?: string; helpUrl: string }) {
  const content = `
    <h2 style="margin: 0 0 20px; font-size: 24px; color: #111;">Update on your application</h2>
    <p style="margin-bottom: 16px;">Hi there,</p>
    <p style="margin-bottom: 16px;">Thank you for registering <strong>${data.businessName}</strong> with SHOUT.</p>
    <p style="margin-bottom: 16px;">Unfortunately, we could not approve your business application at this time.</p>
    ${data.reason ? `
      <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 16px; margin: 20px 0; color: #be123c;">
        <strong>Reason:</strong> ${data.reason}
      </div>
    ` : ''}
    <p style="margin-bottom: 24px;">Please review our guidelines to ensure your business meets all requirements before reapplying.</p>
    <div style="text-align: center;">
      <a href="${data.helpUrl}" style="${buttonStyle.replace('#0d9488', '#4b5563')}">View Guidelines</a>
    </div>
  `;
  return wrapTemplate(content);
}

export function passwordResetTemplate(data: { resetUrl: string }) {
  const content = `
    <h2 style="margin: 0 0 20px; font-size: 24px; color: #111;">Reset your password</h2>
    <p style="margin-bottom: 16px;">We received a request to reset the password for your SHOUT account.</p>
    <p style="margin-bottom: 24px;">If you didn't make this request, you can safely ignore this email.</p>
    <div style="text-align: center;">
      <a href="${data.resetUrl}" style="${buttonStyle}">Reset Password</a>
    </div>
    <p style="margin-top: 24px; font-size: 14px; color: #666;">This link will expire in 1 hour for security reasons.</p>
  `;
  return wrapTemplate(content);
}

export function otpTemplate(data: { otp: string }) {
  const content = `
    <h2 style="margin: 0 0 20px; font-size: 24px; color: #111;">Verify your email</h2>
    <p style="margin-bottom: 16px;">Use the code below to verify your email address and complete your registration.</p>
    <div style="background-color: #f3f4f6; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f97316;">${data.otp}</span>
    </div>
    <p style="margin-bottom: 24px;">This code will expire in 10 minutes.</p>
    <p style="font-size: 14px; color: #666;">If you didn't request this code, please ignore this email.</p>
  `;
  return wrapTemplate(content);
}

export function businessApplicationReceivedTemplate(data: { businessName: string }) {
  const content = `
    <h2 style="margin: 0 0 20px; font-size: 24px; color: #111;">Application Received</h2>
    <p style="margin-bottom: 16px;">Hi there,</p>
    <p style="margin-bottom: 16px;">Thanks for registering <strong>${data.businessName}</strong> with SHOUT!</p>
    <p style="margin-bottom: 16px;">We have received your application and it is currently under review.</p>
    <p style="margin-bottom: 24px;">You will receive another email once your business is approved, at which point you can set your password and access the dashboard.</p>
    <p style="margin-top: 24px; font-size: 14px; color: #666;">If you have any questions, feel free to reply to this email.</p>
  `;
  return wrapTemplate(content);
}