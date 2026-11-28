import {
  DEFAULT_MAINTENANCE_MESSAGE,
  consumePendingAction,
  createBypassToken,
  deletePendingAction,
  formatDurationLabel,
  getMaintenanceDiagnostics,
  getMaintenanceState,
  isAuthorizedTelegramAdmin,
  isUpstashConfigured,
  parseAdminIds,
  parseMaintenanceOnArgs,
  savePendingAction,
  setMaintenanceState,
  type MaintenanceState,
} from '@/lib/maintenance';
import {
  BackupError,
  createPanelBackup,
  createRepoBackup,
  formatBytes,
  sendBackupDocument,
  type BackupKind,
} from '@/lib/backup';

export interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatWibTime(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date) + ' WIB'
  );
}

function actorLabel(user?: TelegramUser): string {
  if (!user) return 'Admin';
  if (user.username) return `@${user.username}`;
  return user.first_name?.trim() || `Admin ${user.id}`;
}

async function telegramApi(method: string, payload: Record<string, unknown>): Promise<void> {
  const rawToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
  const token = rawToken.replace(/^bot(?=\d+:)/i, '');
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN belum dikonfigurasi.');
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Telegram API ${method} gagal (${res.status}): ${text.slice(0, 150)}`);
  }
}

async function sendMessage(
  chatId: number,
  text: string,
  inlineKeyboard?: InlineButton[][]
): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
  });
}

async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  inlineKeyboard?: InlineButton[][]
): Promise<void> {
  await telegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
  }).catch(() => undefined);
}

async function answerCallbackQuery(callbackId: string, text?: string): Promise<void> {
  await telegramApi('answerCallbackQuery', {
    callback_query_id: callbackId,
    ...(text ? { text: text.slice(0, 180) } : {}),
  }).catch(() => undefined);
}

function buildStatusCard(state: MaintenanceState): {
  text: string;
  keyboard: InlineButton[][];
} {
  const storageLabel = isUpstashConfigured() ? 'Upstash Redis' : 'Memori lokal (sementara)';

  if (state.enabled) {
    const lines = [
      '<b>Status Maintenance: AKTIF (503)</b>',
      '',
      `<b>Pesan:</b> ${escapeHtml(state.message)}`,
      `<b>Mulai:</b> ${escapeHtml(formatWibTime(state.startedAt))}`,
      `<b>Estimasi selesai:</b> ${state.endsAt ? escapeHtml(formatWibTime(state.endsAt)) : 'Tanpa batas waktu'}`,
      state.updatedBy ? `<b>Diaktifkan oleh:</b> ${escapeHtml(state.updatedBy)}` : null,
      `<b>Penyimpanan:</b> ${storageLabel}`,
      '',
      '<i>Tip: Kirim /maintenance on 30m Pesan baru untuk mengganti pesan atau durasi.</i>',
    ].filter((line): line is string => line !== null);

    return {
      text: lines.join('\n'),
      keyboard: [
        [
          { text: 'Matikan Maintenance', callback_data: 'm:ask_off' },
          { text: '+15 Menit', callback_data: 'm:extend:15' },
        ],
        [
          { text: 'Buat Link Bypass Admin', callback_data: 'm:bypass' },
          { text: 'Refresh Status', callback_data: 'm:refresh' },
        ],
      ],
    };
  }

  const lines = [
    '<b>Status Maintenance: NONAKTIF (Web Normal)</b>',
    '',
    `<b>Pesan bawaan:</b> ${escapeHtml(state.message)}`,
    `<b>Penyimpanan:</b> ${storageLabel}`,
    '',
    'Pilih durasi cepat di bawah, atau ketik:',
    '<code>/maintenance on 30m Alasan perbaikan</code>',
  ];

  return {
    text: lines.join('\n'),
    keyboard: [
      [
        { text: 'Aktifkan 15m', callback_data: 'm:preset:15' },
        { text: 'Aktifkan 30m', callback_data: 'm:preset:30' },
        { text: 'Aktifkan 1j', callback_data: 'm:preset:60' },
      ],
      [
        { text: 'Aktifkan (Tanpa Batas)', callback_data: 'm:preset:0' },
        { text: 'Refresh Status', callback_data: 'm:refresh' },
      ],
    ],
  };
}

function buildConfirmationCard(params: {
  pendingId: string;
  action: 'enable' | 'disable';
  durationMinutes: number | null;
  message: string;
}): { text: string; keyboard: InlineButton[][] } {
  if (params.action === 'disable') {
    return {
      text: [
        '<b>Konfirmasi Matikan Maintenance</b>',
        '',
        'Seluruh pengunjung akan langsung bisa mengakses Aznime kembali secara normal.',
      ].join('\n'),
      keyboard: [
        [
          { text: 'Ya, Matikan Sekarang', callback_data: `m:confirm:${params.pendingId}` },
          { text: 'Batal', callback_data: `m:cancel:${params.pendingId}` },
        ],
      ],
    };
  }

  return {
    text: [
      '<b>Konfirmasi Aktifkan Maintenance</b>',
      '',
      `<b>Durasi:</b> ${escapeHtml(formatDurationLabel(params.durationMinutes))}`,
      `<b>Pesan:</b> ${escapeHtml(params.message)}`,
      '',
      'Pengunjung umum akan menerima status 503 sampai dimatikan atau menggunakan link bypass admin.',
    ].join('\n'),
    keyboard: [
      [
        { text: 'Ya, Aktifkan Sekarang', callback_data: `m:confirm:${params.pendingId}` },
        { text: 'Batal', callback_data: `m:cancel:${params.pendingId}` },
      ],
    ],
  };
}

async function sendBypassLink(chatId: number, siteOrigin: string): Promise<void> {
  const token = await createBypassToken();
  const bypassUrl = `${siteOrigin.replace(/\/+$/, '')}/api/maintenance/bypass?token=${encodeURIComponent(token)}`;
  await sendMessage(
    chatId,
    [
      '<b>Link Bypass Admin (Berlaku 12 Jam)</b>',
      '',
      'Buka tautan ini di browser kamu untuk tetap mengakses Aznime selama mode maintenance aktif:',
      `<a href="${escapeHtml(bypassUrl)}">Buka Aznime dengan Bypass Admin</a>`,
      '',
      `<code>${escapeHtml(bypassUrl)}</code>`,
      '',
      '<i>Jangan bagikan tautan ini ke pengunjung umum.</i>',
    ].join('\n')
  );
}

/** Kartu pilihan backup: dua sumber berkas yang bisa dikirim ke chat ini. */
function buildBackupCard(): { text: string; keyboard: InlineButton[][] } {
  return {
    text: [
      '<b>Backup Aznime</b>',
      'Pilih berkas yang mau dikirim ke chat ini:',
      '',
      '• <b>Repo GitHub</b> — ZIP branch <code>main</code> dari AomiXplorer/Aznime.',
      '• <b>Panel Pterodactyl</b> — tar.gz isi server: skrip start, pengawas rilis,',
      '  folder <code>shared</code> (runtime.env, release.json), dan rilis yang aktif.',
      '',
      '<i>node_modules, .next, .git, dan cache npm tidak pernah ikut.</i>',
    ].join('\n'),
    keyboard: [
      [{ text: 'Backup Repo GitHub', callback_data: 'b:repo' }],
      [{ text: 'Backup Panel Pterodactyl', callback_data: 'b:panel' }],
    ],
  };
}

function backupProgressText(kind: BackupKind): string {
  return kind === 'repo'
    ? '<i>Mengambil arsip repo dari GitHub...</i>'
    : '<i>Membuat arsip isi panel Pterodactyl...</i>';
}

function backupDoneText(file: { filename: string; data: Buffer; kind: BackupKind }): string {
  return [
    '<b>Backup selesai</b>',
    `• Sumber: ${file.kind === 'repo' ? 'repo GitHub' : 'panel Pterodactyl'}`,
    `• Berkas: <code>${escapeHtml(file.filename)}</code>`,
    `• Ukuran: ${formatBytes(file.data.length)}`,
  ].join('\n');
}

/**
 * Dijalankan tanpa ditunggu: Bot API hanya menunggu webhook beberapa detik,
 * sedangkan membuat arsip panel bisa lama. Kegagalan dilaporkan ke chat.
 */
async function deliverBackup(chatId: number, kind: BackupKind): Promise<void> {
  try {
    const file = kind === 'repo' ? await createRepoBackup() : await createPanelBackup();
    const caption =
      kind === 'repo'
        ? `Aznime — repo GitHub (${formatBytes(file.data.length)})`
        : `Aznime — panel Pterodactyl (${formatBytes(file.data.length)})`;
    await sendBackupDocument(chatId, file, caption);
    await sendMessage(chatId, backupDoneText(file));
  } catch (error) {
    const message =
      error instanceof BackupError || error instanceof Error
        ? error.message
        : 'Kesalahan tidak dikenal.';
    await sendMessage(chatId, `<b>Backup gagal</b>\n<i>${escapeHtml(message)}</i>`).catch(
      () => undefined
    );
  }
}

async function startBackup(chatId: number, kind: BackupKind): Promise<void> {
  await sendMessage(chatId, backupProgressText(kind));
  void deliverBackup(chatId, kind);
}

export async function handleTelegramUpdate(update: TelegramUpdate, siteOrigin: string): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, siteOrigin);
    return;
  }

  if (update.message) {
    await handleMessage(update.message, siteOrigin);
  }
}

function logUnauthorizedTelegramAttempt(
  kind: 'message' | 'callback',
  userId?: number,
  chatId?: number
): void {
  if (parseAdminIds().size === 0) {
    console.warn(
      `[Telegram] Ignored ${kind}: TELEGRAM_ADMIN_IDS is empty or invalid in environment.`
    );
    return;
  }
  console.warn(
    `[Telegram] Ignored ${kind} from unauthorized userId=${userId ?? 'unknown'} chatId=${chatId ?? 'unknown'}.`
  );
}

function buildDiagnosticsSummary(): string {
  const diag = getMaintenanceDiagnostics();
  const upstashStatus = diag.upstashInvalidScheme
    ? 'Salah format (harus https://, bukan rediss://)'
    : diag.upstashConfigured
      ? 'Terhubung (REST API)'
      : 'Belum diisi (fallback memori)';

  return [
    '<b>Diagnostik Server</b>',
    `• <b>Upstash Redis:</b> ${upstashStatus}`,
    `• <b>Webhook Secret:</b> ${diag.webhookSecretConfigured ? 'Terpasang' : 'Belum diisi'}`,
    `• <b>Admin IDs:</b> ${diag.adminIdsCount} terdaftar`,
    `• <b>Bypass Secret:</b> ${diag.bypassSecretConfigured ? 'Terpasang' : 'Ephemeral per restart'}`,
    `• <b>Waktu server:</b> ${escapeHtml(formatWibTime(new Date().toISOString()))}`,
  ].join('\n');
}

async function handleMessage(message: TelegramMessage, siteOrigin: string): Promise<void> {
  const chatId = message.chat.id;
  const userId = message.from?.id;

  if (!isAuthorizedTelegramAdmin(userId, chatId)) {
    logUnauthorizedTelegramAttempt('message', userId, chatId);
    return;
  }

  const rawText = (message.text || '').trim();
  if (!rawText.startsWith('/')) return;

  const [rawCommand, ...restTokens] = rawText.split(/\s+/);
  const command = rawCommand.split('@')[0].toLowerCase();
  const subRaw = restTokens.join(' ').trim();

  if (command === '/start' || command === '/help') {
    const state = await getMaintenanceState({ bypassCache: true });
    const card = buildStatusCard(state);
    await sendMessage(
      chatId,
      [
        '<b>Panel Kendali Maintenance Aznime</b>',
        '',
        '<b>Perintah tersedia:</b>',
        '• <code>/status</code> — Status maintenance & diagnostik server',
        '• <code>/maintenance</code> — Status & tombol cepat',
        '• <code>/maintenance on 30m Pesan</code> — Aktifkan dengan estimasi & pesan',
        '• <code>/maintenance off</code> — Matikan mode maintenance',
        '• <code>/maintenance pesan Teks</code> — Ganti pesan maintenance',
        '• <code>/maintenance bypass</code> — Buat link akses admin',
        '• <code>/backup</code> — Kirim backup repo GitHub atau panel Pterodactyl',
        '• <code>/backup repo</code> / <code>/backup panel</code> — Langsung pilih sumber',
        '',
        card.text,
      ].join('\n'),
      card.keyboard
    );
    return;
  }

  if (command === '/status') {
    const state = await getMaintenanceState({ bypassCache: true });
    const card = buildStatusCard(state);
    await sendMessage(chatId, `${card.text}\n\n${buildDiagnosticsSummary()}`, card.keyboard);
    return;
  }

  if (command === '/backup') {
    const target = subRaw.toLowerCase();
    if (target === 'repo' || target === 'github') {
      await startBackup(chatId, 'repo');
      return;
    }
    if (target === 'panel' || target === 'pterodactyl') {
      await startBackup(chatId, 'panel');
      return;
    }
    const card = buildBackupCard();
    await sendMessage(chatId, card.text, card.keyboard);
    return;
  }

  if (command !== '/maintenance') return;

  const subFirst = (restTokens[0] || '').toLowerCase();
  const afterSub = restTokens.slice(1).join(' ').trim();

  if (!subRaw || subFirst === 'status') {
    const state = await getMaintenanceState({ bypassCache: true });
    const card = buildStatusCard(state);
    await sendMessage(chatId, card.text, card.keyboard);
    return;
  }

  if (subFirst === 'bypass') {
    await sendBypassLink(chatId, siteOrigin);
    return;
  }

  if (subFirst === 'off') {
    const pending = await savePendingAction({
      action: 'disable',
      durationMinutes: null,
      message: '',
      requestedBy: actorLabel(message.from),
      chatId,
    });
    const confirm = buildConfirmationCard({
      pendingId: pending.id,
      action: 'disable',
      durationMinutes: null,
      message: '',
    });
    await sendMessage(chatId, confirm.text, confirm.keyboard);
    return;
  }

  if (subFirst === 'on') {
    const parsed = parseMaintenanceOnArgs(afterSub);
    const current = await getMaintenanceState({ bypassCache: true });
    const finalMessage = parsed.message || current.message || DEFAULT_MAINTENANCE_MESSAGE;
    const pending = await savePendingAction({
      action: 'enable',
      durationMinutes: parsed.durationMinutes,
      message: finalMessage,
      requestedBy: actorLabel(message.from),
      chatId,
    });
    const confirm = buildConfirmationCard({
      pendingId: pending.id,
      action: 'enable',
      durationMinutes: parsed.durationMinutes,
      message: finalMessage,
    });
    await sendMessage(chatId, confirm.text, confirm.keyboard);
    return;
  }

  if (subFirst === 'pesan' || subFirst === 'msg') {
    if (!afterSub) {
      await sendMessage(
        chatId,
        'Sertakan isi pesan setelah perintah. Contoh:\n<code>/maintenance pesan Sedang ganti mirror stream utama</code>'
      );
      return;
    }
    const current = await getMaintenanceState({ bypassCache: true });
    const updated = await setMaintenanceState({
      ...current,
      message: afterSub.slice(0, 500),
      updatedBy: actorLabel(message.from),
      updatedAt: new Date().toISOString(),
    });
    const card = buildStatusCard(updated);
    await sendMessage(chatId, `<b>Pesan maintenance diperbarui.</b>\n\n${card.text}`, card.keyboard);
    return;
  }

  await sendMessage(
    chatId,
    [
      'Sub-perintah tidak dikenali. Contoh penggunaan:',
      '• <code>/maintenance</code>',
      '• <code>/maintenance on 30m Perbaikan server</code>',
      '• <code>/maintenance off</code>',
      '• <code>/maintenance bypass</code>',
    ].join('\n')
  );
}

async function handleCallbackQuery(query: TelegramCallbackQuery, siteOrigin: string): Promise<void> {
  const msg = query.message;
  const chatId = msg?.chat.id;
  const userId = query.from.id;

  if (!isAuthorizedTelegramAdmin(userId, chatId)) {
    logUnauthorizedTelegramAttempt('callback', userId, chatId);
    await answerCallbackQuery(query.id, 'Akses ditolak.');
    return;
  }

  if (!msg || !chatId) {
    await answerCallbackQuery(query.id);
    return;
  }

  const data = query.data || '';

  if (data === 'm:refresh') {
    const state = await getMaintenanceState({ bypassCache: true });
    const card = buildStatusCard(state);
    await editMessageText(chatId, msg.message_id, card.text, card.keyboard);
    await answerCallbackQuery(query.id, 'Status diperbarui.');
    return;
  }

  if (data === 'm:bypass') {
    await answerCallbackQuery(query.id, 'Membuat link bypass...');
    await sendBypassLink(chatId, siteOrigin);
    return;
  }

  if (data === 'm:ask_off') {
    const pending = await savePendingAction({
      action: 'disable',
      durationMinutes: null,
      message: '',
      requestedBy: actorLabel(query.from),
      chatId,
    });
    const confirm = buildConfirmationCard({
      pendingId: pending.id,
      action: 'disable',
      durationMinutes: null,
      message: '',
    });
    await editMessageText(chatId, msg.message_id, confirm.text, confirm.keyboard);
    await answerCallbackQuery(query.id);
    return;
  }

  if (data.startsWith('m:preset:')) {
    const rawMins = Number(data.slice('m:preset:'.length));
    const durationMinutes = Number.isFinite(rawMins) && rawMins > 0 ? Math.trunc(rawMins) : null;
    const current = await getMaintenanceState({ bypassCache: true });
    const pending = await savePendingAction({
      action: 'enable',
      durationMinutes,
      message: current.message || DEFAULT_MAINTENANCE_MESSAGE,
      requestedBy: actorLabel(query.from),
      chatId,
    });
    const confirm = buildConfirmationCard({
      pendingId: pending.id,
      action: 'enable',
      durationMinutes,
      message: pending.message,
    });
    await editMessageText(chatId, msg.message_id, confirm.text, confirm.keyboard);
    await answerCallbackQuery(query.id);
    return;
  }

  if (data === 'm:extend:15') {
    const current = await getMaintenanceState({ bypassCache: true });
    if (!current.enabled) {
      const card = buildStatusCard(current);
      await editMessageText(chatId, msg.message_id, card.text, card.keyboard);
      await answerCallbackQuery(query.id, 'Mode maintenance sedang tidak aktif.');
      return;
    }
    const baseMs =
      current.endsAt && Date.parse(current.endsAt) > Date.now()
        ? Date.parse(current.endsAt)
        : Date.now();
    const nextEndsAt = new Date(baseMs + 15 * 60_000).toISOString();
    const updated = await setMaintenanceState({
      ...current,
      endsAt: nextEndsAt,
      updatedBy: actorLabel(query.from),
      updatedAt: new Date().toISOString(),
    });
    const card = buildStatusCard(updated);
    await editMessageText(chatId, msg.message_id, card.text, card.keyboard);
    await answerCallbackQuery(query.id, 'Estimasi ditambah 15 menit.');
    return;
  }

  if (data.startsWith('m:cancel:')) {
    const pendingId = data.slice('m:cancel:'.length);
    await deletePendingAction(pendingId);
    await editMessageText(chatId, msg.message_id, 'Aksi dibatalkan.', [
      [{ text: 'Lihat Status', callback_data: 'm:refresh' }],
    ]);
    await answerCallbackQuery(query.id, 'Dibatalkan.');
    return;
  }

  if (data.startsWith('m:confirm:')) {
    const pendingId = data.slice('m:confirm:'.length);
    const pending = await consumePendingAction(pendingId);
    if (!pending) {
      const state = await getMaintenanceState({ bypassCache: true });
      const card = buildStatusCard(state);
      await editMessageText(
        chatId,
        msg.message_id,
        `<i>Konfirmasi sudah kedaluwarsa.</i>\n\n${card.text}`,
        card.keyboard
      );
      await answerCallbackQuery(query.id, 'Konfirmasi kedaluwarsa.');
      return;
    }

    const nowIso = new Date().toISOString();
    const nextState =
      pending.action === 'enable'
        ? await setMaintenanceState({
            enabled: true,
            message: pending.message || DEFAULT_MAINTENANCE_MESSAGE,
            startedAt: nowIso,
            endsAt: pending.durationMinutes
              ? new Date(Date.now() + pending.durationMinutes * 60_000).toISOString()
              : null,
            updatedBy: pending.requestedBy,
            updatedAt: nowIso,
          })
        : await setMaintenanceState({
            enabled: false,
            message: DEFAULT_MAINTENANCE_MESSAGE,
            startedAt: null,
            endsAt: null,
            updatedBy: pending.requestedBy,
            updatedAt: nowIso,
          });

    const card = buildStatusCard(nextState);
    await editMessageText(chatId, msg.message_id, card.text, card.keyboard);
    await answerCallbackQuery(
      query.id,
      nextState.enabled ? 'Maintenance diaktifkan.' : 'Maintenance dimatikan.'
    );
    return;
  }

  if (data === 'b:repo' || data === 'b:panel') {
    const kind: BackupKind = data === 'b:repo' ? 'repo' : 'panel';
    await editMessageText(chatId, msg.message_id, backupProgressText(kind));
    await answerCallbackQuery(query.id, 'Menyiapkan backup...');
    void deliverBackup(chatId, kind);
    return;
  }

  await answerCallbackQuery(query.id);
}
