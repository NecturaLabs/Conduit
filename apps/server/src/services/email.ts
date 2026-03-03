import { Resend } from 'resend';
import { config } from '../config.js';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(config.resendApiKey);
  }
  return _resend;
}

interface MinimalLogger {
  error: (msg: string, ...args: unknown[]) => void;
}

const fallbackLogger: MinimalLogger = {
  error: (msg: string, ...args: unknown[]) => console.error(msg, ...args),
};

export async function sendMagicLink(
  email: string,
  token: string,
  appUrl: string,
  logger: MinimalLogger = fallbackLogger,
  /** Optional deep-link base URL (e.g. conduit://auth/verify). When provided,
   *  this is used instead of appUrl so mobile clients open the app directly.
   *  Only conduit:// scheme is accepted — validated by the caller. */
  callbackUrl?: string,
): Promise<void> {
  const verifyUrl = callbackUrl
    ? `${callbackUrl}?token=${encodeURIComponent(token)}`
    : `${appUrl}/app/auth/verify?token=${encodeURIComponent(token)}`;

  const html = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Sign in to Conduit</title>
</head>
<body style="margin:0;padding:0;background-color:#08090a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#08090a;">
    <tr>
      <td align="center" style="padding:48px 16px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
          <tr>
            <td style="background-color:#111315;border-radius:16px;border:1px solid #1e2024;overflow:hidden;">

              <!-- Top accent bar -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#6366f1 0%,#8b5cf6 50%,#a78bfa 100%);border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Body -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:40px 44px 36px;">

                    <!-- Logo + wordmark -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:32px;">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">
                          <!-- Icon box -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;text-align:center;vertical-align:middle;">
                                <span style="display:inline-block;font-size:18px;line-height:36px;">&#9889;</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-size:20px;font-weight:700;color:#f8f9fa;letter-spacing:-0.03em;">Conduit</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Heading -->
                    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#f8f9fa;letter-spacing:-0.03em;line-height:1.2;">Your sign-in link</h1>
                    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                      Click the button below to sign in to your Conduit dashboard. This link expires in&nbsp;<strong style="color:#c4b5fd;font-weight:600;">15 minutes</strong>&nbsp;and is single-use.
                    </p>

                    <!-- CTA button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:32px;">
                      <tr>
                        <td style="border-radius:10px;background:linear-gradient(135deg,#6366f1,#7c3aed);box-shadow:0 4px 14px rgba(99,102,241,0.35);">
                          <a href="${verifyUrl}" target="_blank"
                             style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                            Sign in to Conduit &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
                      <tr>
                        <td style="height:1px;background-color:#1e2024;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>

                    <!-- Fallback URL -->
                    <p style="margin:0 0 6px;font-size:13px;color:#4b5563;line-height:1.5;">
                      Button not working? Copy and paste this link into your browser:
                    </p>
                    <p style="margin:0;font-size:12px;color:#374151;word-break:break-all;line-height:1.6;font-family:'Courier New',Courier,monospace;background-color:#0d0f10;border:1px solid #1e2024;border-radius:6px;padding:10px 12px;">
                      ${verifyUrl}
                    </p>

                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:20px 44px 28px;border-top:1px solid #1e2024;">
                    <p style="margin:0;font-size:12px;color:#374151;line-height:1.6;">
                      If you didn&rsquo;t request this email, no action is needed &mdash; your account remains secure.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Dev mode: when no RESEND_API_KEY is configured, log the link to stdout
  // so self-hosters can sign in without an email provider.
  if (!config.resendApiKey) {
    console.log(`\n[DEV] Magic link for ${email}:\n  ${verifyUrl}\n`);
    return;
  }

  try {
    const resend = getResend();
    await resend.emails.send({
      from: config.emailFrom,
      to: email,
      subject: 'Sign in to Conduit',
      html,
    });
  } catch (err) {
    // Log error but never expose email delivery status to the caller
    logger.error('Failed to send magic link email:', err instanceof Error ? err.message : err);
  }
}
