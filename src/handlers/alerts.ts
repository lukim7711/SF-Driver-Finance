/**
 * Due Date Alert System — F03d
 *
 * Proactively checks for upcoming/overdue installments and sends
 * a warning banner BEFORE the normal response. Throttled to max
 * once per 6 hours to avoid spamming the user.
 *
 * Triggered: On every user message (before intent processing).
 */

import type { InstallmentRow, LoanRow } from "../types/loan";
import { sendText } from "../telegram/api";
import { formatRupiah } from "./income";

/** Alert urgency levels */
interface AlertItem {
  platform: string;
  installmentNo: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  urgency: "overdue" | "today" | "soon";
}

/** Throttle interval in hours */
const ALERT_THROTTLE_HOURS = 6;

/** How many days ahead to warn */
const ALERT_WINDOW_DAYS = 3;

/**
 * Ensure the alert metadata table exists.
 * Tracks last alert timestamp to throttle notifications.
 */
export function ensureAlertMetaTable(db: SqlStorage): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _alert_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

/**
 * Check if enough time has passed since last alert.
 * Returns true if we should send an alert.
 */
function shouldSendAlert(db: SqlStorage, nowMs: number): boolean {
  const result = db.exec(
    "SELECT value FROM _alert_meta WHERE key = 'last_alert_at'"
  ).toArray();

  if (result.length === 0) return true;

  const lastAlertAt = Number((result[0] as unknown as { value: string }).value);
  const hoursSinceLast = (nowMs - lastAlertAt) / (1000 * 60 * 60);

  return hoursSinceLast >= ALERT_THROTTLE_HOURS;
}

/**
 * Update the last alert timestamp.
 */
function updateLastAlertTime(db: SqlStorage, nowMs: number): void {
  db.exec(
    `INSERT INTO _alert_meta (key, value) VALUES ('last_alert_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    nowMs.toString()
  );
}

/**
 * Main entry point: check for alertable installments and send warning if needed.
 * Called before every message processing in the Durable Object.
 *
 * @returns true if an alert was sent, false otherwise
 */
export async function checkAndSendAlerts(
  token: string,
  chatId: number,
  db: SqlStorage,
  todayDate: string
): Promise<boolean> {
  const nowMs = Date.now();

  // Throttle check
  if (!shouldSendAlert(db, nowMs)) {
    return false;
  }

  // Find alertable installments
  const alerts = getAlertableInstallments(db, todayDate);

  if (alerts.length === 0) {
    return false;
  }

  // Build and send alert message
  const message = buildAlertMessage(alerts);
  await sendText(token, chatId, message);

  // Update throttle timestamp
  updateLastAlertTime(db, nowMs);

  return true;
}

/**
 * Find all installments that are overdue or due within ALERT_WINDOW_DAYS.
 */
function getAlertableInstallments(
  db: SqlStorage,
  todayDate: string
): AlertItem[] {
  const today = new Date(todayDate);
  const windowEnd = new Date(todayDate);
  windowEnd.setDate(windowEnd.getDate() + ALERT_WINDOW_DAYS);
  const windowEndStr = windowEnd.toISOString().split("T")[0]!;

  // Get overdue + upcoming installments within window
  const rows = db.exec(
    `SELECT i.installment_no, i.amount, i.due_date,
            l.platform, l.total_installments
     FROM installments i
     JOIN loans l ON i.loan_id = l.id
     WHERE i.status IN ('unpaid', 'late')
       AND l.status = 'active'
       AND i.due_date <= ?
     ORDER BY i.due_date ASC`,
    windowEndStr
  ).toArray() as unknown as Array<{
    installment_no: number;
    amount: number;
    due_date: string;
    platform: string;
    total_installments: number;
  }>;

  return rows.map((row) => {
    const dueDate = new Date(row.due_date);
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    let urgency: AlertItem["urgency"];
    if (daysUntilDue < 0) {
      urgency = "overdue";
    } else if (daysUntilDue === 0) {
      urgency = "today";
    } else {
      urgency = "soon";
    }

    return {
      platform: row.platform,
      installmentNo: row.installment_no,
      totalInstallments: row.total_installments,
      amount: row.amount,
      dueDate: row.due_date,
      daysUntilDue,
      urgency,
    };
  });
}

/**
 * Build the alert notification message.
 * Groups by urgency: overdue first, then today, then upcoming.
 */
function buildAlertMessage(alerts: AlertItem[]): string {
  const overdue = alerts.filter((a) => a.urgency === "overdue");
  const today = alerts.filter((a) => a.urgency === "today");
  const soon = alerts.filter((a) => a.urgency === "soon");

  let text = "⏰ <b>Pengingat Cicilan</b>\n";

  if (overdue.length > 0) {
    text += "\n\ud83d\udd34 <b>TELAT BAYAR:</b>\n";
    for (const a of overdue) {
      text += `\u2022 <b>${a.platform}</b> ke-${a.installmentNo}/${a.totalInstallments}`;
      text += ` \u2014 ${formatRupiah(a.amount)}`;
      text += ` (telat ${Math.abs(a.daysUntilDue)} hari)\n`;
    }
  }

  if (today.length > 0) {
    text += "\n\u26a0\ufe0f <b>JATUH TEMPO HARI INI:</b>\n";
    for (const a of today) {
      text += `\u2022 <b>${a.platform}</b> ke-${a.installmentNo}/${a.totalInstallments}`;
      text += ` \u2014 ${formatRupiah(a.amount)}\n`;
    }
  }

  if (soon.length > 0) {
    text += "\n\ud83d\udfe1 <b>SEGERA JATUH TEMPO:</b>\n";
    for (const a of soon) {
      text += `\u2022 <b>${a.platform}</b> ke-${a.installmentNo}/${a.totalInstallments}`;
      text += ` \u2014 ${formatRupiah(a.amount)}`;
      text += ` (${a.daysUntilDue} hari lagi)\n`;
    }
  }

  text += "\n\ud83d\udca1 Ketik <i>\"bayar cicilan [nama]\"</i> untuk mencatat pembayaran.";

  return text;
}
