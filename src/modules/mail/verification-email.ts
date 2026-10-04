import type { Locale } from '@prisma/client';

interface VerificationCopy {
  subject: string;
  heading: string;
  intro: string;
  codeLabel: string;
  expiry: string;
  ignore: string;
}

const COPY: Record<Locale, VerificationCopy> = {
  en: {
    subject: 'Your Personal Planner code',
    heading: 'Confirm your email',
    intro: 'Enter this code in Personal Planner to finish creating your account.',
    codeLabel: 'Verification code',
    expiry: 'The code is valid for 15 minutes.',
    ignore: 'If you did not sign up, you can ignore this message.',
  },
  ru: {
    subject: 'Код для Personal Planner',
    heading: 'Подтвердите почту',
    intro: 'Введите этот код в Personal Planner, чтобы завершить регистрацию.',
    codeLabel: 'Код подтверждения',
    expiry: 'Код действует 15 минут.',
    ignore: 'Если вы не регистрировались, просто проигнорируйте это письмо.',
  },
  uk: {
    subject: 'Код для Personal Planner',
    heading: 'Підтвердіть пошту',
    intro: 'Введіть цей код у Personal Planner, щоб завершити реєстрацію.',
    codeLabel: 'Код підтвердження',
    expiry: 'Код дійсний 15 хвилин.',
    ignore: 'Якщо ви не реєструвалися, просто проігноруйте цей лист.',
  },
};

const MONO = "'Martian Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SANS = "'IBM Plex Sans', -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const renderVerificationEmail = (locale: Locale, code: string): RenderedEmail => {
  const copy = COPY[locale];
  const spaced = code.split('').join(' ');

  const html = `<!doctype html>
<html lang="${locale}">
<body style="margin:0;padding:32px 16px;background:#0c0d0f;color:#e8e9e5;font-family:${SANS};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;border:1px solid #2a2c31;background:#141519;">
    <tr>
      <td style="padding:16px 20px;border-bottom:1px solid #2a2c31;font-family:${MONO};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#868a91;">
        Personal Planner <span style="display:inline-block;width:7px;height:11px;background:#8b95ff;vertical-align:-1px;"></span>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 20px 8px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;letter-spacing:-0.02em;text-transform:uppercase;color:#e8e9e5;">${copy.heading}</h1>
        <p style="margin:0;font-size:15px;line-height:1.5;color:#a8abb0;">${copy.intro}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px;">
        <div style="font-family:${MONO};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#868a91;margin-bottom:8px;">${copy.codeLabel}</div>
        <div style="border:1px solid #e8e9e5;padding:16px;font-family:${MONO};font-size:28px;letter-spacing:0.18em;color:#e8e9e5;text-align:center;">${spaced}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px 24px;font-size:13px;line-height:1.5;color:#868a91;">
        ${copy.expiry}<br />${copy.ignore}
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${copy.heading}\n\n${copy.intro}\n\n${copy.codeLabel}: ${code}\n\n${copy.expiry}\n${copy.ignore}`;

  return { subject: copy.subject, html, text };
};
