/* =====================================================================
   Email. Until a mail server is connected (EMAIL_TRANSPORT=console),
   emails are written to the server log so sign-up and password reset
   can be tested end to end. To connect email later, implement `send`
   for your provider (SMTP / SES / Postmark…) — nothing else changes.
   ===================================================================== */
import { config } from "../config.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export const outbox: Mail[] = []; // the last few, for tests

export async function sendMail(m: Mail) {
  if (config.emailTransport === "console") {
    outbox.push(m);
    if (outbox.length > 50) outbox.shift();
    console.log(JSON.stringify({ level: "mail", to: m.to.replace(/(.).+(@.+)/, "$1***$2"), subject: m.subject }));
    return;
  }
  throw new Error(`EMAIL_TRANSPORT "${config.emailTransport}" is not set up yet`);
}
