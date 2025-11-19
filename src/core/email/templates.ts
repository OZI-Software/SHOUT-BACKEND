export function businessApprovedTemplate(data: { businessName: string; dashboardUrl: string }) {
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111;">
    <h2 style="margin:0 0 12px">Your business is approved 🎉</h2>
    <p>Hi,</p>
    <p>Your business <strong>${data.businessName}</strong> has been approved on SHOUT.</p>
    <p>You can now manage your offers and profile from your dashboard.</p>
    <p>
      <a href="${data.dashboardUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Go to dashboard</a>
    </p>
    <p style="margin-top:20px;color:#555">Thanks for being part of SHOUT!</p>
  </div>
  `;
}

export function businessRejectedTemplate(data: { businessName: string; reason?: string; helpUrl: string }) {
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111;">
    <h2 style="margin:0 0 12px">Business application update</h2>
    <p>Hi,</p>
    <p>We’re sorry to say your business <strong>${data.businessName}</strong> was not approved.</p>
    ${data.reason ? `<p>Reason: ${data.reason}</p>` : ''}
    <p>If you believe this was a mistake, reply to this email or review the guidelines below.</p>
    <p>
      <a href="${data.helpUrl}" style="display:inline-block;padding:10px 14px;background:#6b7280;color:#fff;border-radius:8px;text-decoration:none">View guidelines</a>
    </p>
    <p style="margin-top:20px;color:#555">You can re-apply at any time.</p>
  </div>
  `;
}

export function passwordResetTemplate(data: { resetUrl: string }) {
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111;">
    <h2 style="margin:0 0 12px">Reset your password</h2>
    <p>We received a request to reset your password.</p>
    <p>If you didn’t request this, you can safely ignore this email.</p>
    <p>
      <a href="${data.resetUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Reset password</a>
    </p>
    <p style="margin-top:20px;color:#555">This link expires in 1 hour.</p>
  </div>
  `;
}