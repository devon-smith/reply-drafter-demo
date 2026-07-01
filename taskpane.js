/*
 * Reply Drafter (Demo) — Office.js only. No backend, no AI, no Microsoft Graph.
 * Proves: (1) the add-in loaded (Gate 1), (2) it can read the open message,
 * (3) it can open a reply with prefilled text.
 */

const el = (id) => document.getElementById(id);

// Cached fields from the last "Read this email" click.
let last = { fromName: "", fromEmail: "", subject: "", body: "" };

Office.onReady((info) => {
  const status = el("status");

  if (info.host !== Office.HostType.Outlook) {
    setStatus("This add-in only runs inside Outlook.", "err");
    return;
  }

  setStatus("Office.js connected. Add-in is running.", "ok");
  el("read-btn").disabled = false;
  el("read-btn").addEventListener("click", readEmail);
  el("draft-btn").addEventListener("click", draftReply);
});

function setStatus(msg, kind) {
  const s = el("status");
  s.textContent = msg;
  s.className = "status" + (kind ? " " + kind : "");
}

function readEmail() {
  const item = Office.context.mailbox.item;
  if (!item) {
    setStatus("No message is open. Select an email, then try again.", "err");
    return;
  }

  last.subject = item.subject || "(no subject)";
  last.fromName = (item.from && item.from.displayName) || "there";
  last.fromEmail = (item.from && item.from.emailAddress) || "";

  el("r-from").textContent = last.fromEmail
    ? `${last.fromName} <${last.fromEmail}>`
    : last.fromName;
  el("r-subject").textContent = last.subject;

  // Body is fetched asynchronously in read mode.
  item.body.getAsync(Office.CoercionType.Text, (result) => {
    if (result.status === Office.AsyncResultStatus.Succeeded) {
      last.body = (result.value || "").trim();
      const preview = last.body.slice(0, 400) + (last.body.length > 400 ? "…" : "");
      el("r-body").textContent = preview || "(empty body)";
      el("readout").hidden = false;
      el("draft-btn").disabled = false;
      setStatus("Read the message successfully.", "ok");
    } else {
      setStatus("Could not read the body: " + result.error.message, "err");
    }
  });
}

function draftReply() {
  const firstName = last.fromName.split(" ")[0];

  // ----------------------------------------------------------------------
  // AI SLOT: in the real product, replace `replyText` below with a call to
  // your backend, which runs retrieval (your sent-mail voice profile + KB)
  // and generation, then returns the drafted reply. For this demo it's a
  // static template so nothing depends on network/API access.
  // ----------------------------------------------------------------------
  const replyText =
    `Hi ${firstName},\n\n` +
    `Thanks for your note about "${last.subject}". ` +
    `[This is placeholder text — the generated reply will appear here.]\n\n` +
    `Best,\n`;

  // Opens a reply to the current message, prefilled and fully editable.
  Office.context.mailbox.item.displayReplyForm(replyText);
  setStatus("Opened a reply with prefilled text. Edit and send as normal.", "ok");
}
