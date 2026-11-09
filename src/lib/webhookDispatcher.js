/**
 * Webhook Dispatcher for Discord, Telegram, and Slack
 * Sends instant alert pings when account model groups finish cooling down.
 */

const WEBHOOK_STORAGE_KEY = 'ap_webhook_config'

const DEFAULT_CONFIG = {
  discordEnabled: false,
  discordUrl: '',
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  slackEnabled: false,
  slackUrl: '',
}

export function getWebhookConfig() {
  try {
    const raw = localStorage.getItem(WEBHOOK_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveWebhookConfig(config) {
  const merged = { ...getWebhookConfig(), ...config }
  localStorage.setItem(WEBHOOK_STORAGE_KEY, JSON.stringify(merged))
  return merged
}

async function postDiscord(url, title, message) {
  if (!url || !url.startsWith('http')) return false
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'AccountPulse',
      embeds: [
        {
          title,
          description: message,
          color: 0x10b981,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  })
  return res.ok
}

async function postTelegram(botToken, chatId, title, message) {
  if (!botToken || !chatId) return false
  const endpoint = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId.trim(),
      text: `✅ *${title}*\n${message}`,
      parse_mode: 'Markdown',
    }),
  })
  return res.ok
}

async function postSlack(url, title, message) {
  if (!url || !url.startsWith('http')) return false
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `*${title}*\n${message}`,
    }),
  })
  return res.ok
}

/**
 * Dispatches configured webhooks when a group finishes cooldown
 */
export async function dispatchReadyWebhook({ email, platform, groupName }) {
  const cfg = getWebhookConfig()
  const title = `Quota Ready: ${groupName}`
  const message = `Account \`${email}\` (${platform || 'AI Platform'}) has finished cooling down and is ready to use.`

  const tasks = []
  if (cfg.discordEnabled && cfg.discordUrl) {
    tasks.push(postDiscord(cfg.discordUrl, title, message).catch(() => false))
  }
  if (cfg.telegramEnabled && cfg.telegramBotToken && cfg.telegramChatId) {
    tasks.push(postTelegram(cfg.telegramBotToken, cfg.telegramChatId, title, message).catch(() => false))
  }
  if (cfg.slackEnabled && cfg.slackUrl) {
    tasks.push(postSlack(cfg.slackUrl, title, message).catch(() => false))
  }

  if (tasks.length === 0) return []
  return Promise.all(tasks)
}

/**
 * Sends a test ping to a specific provider ('discord' | 'telegram' | 'slack')
 */
export async function sendTestWebhook(provider, customCfg = null) {
  const cfg = customCfg || getWebhookConfig()
  const title = 'AccountPulse Webhook Test'
  const message = 'Your AccountPulse webhook integration is active! You will receive instant alerts here when cooldown timers reach Ready.'

  try {
    if (provider === 'discord') {
      return await postDiscord(cfg.discordUrl, title, message)
    }
    if (provider === 'telegram') {
      return await postTelegram(cfg.telegramBotToken, cfg.telegramChatId, title, message)
    }
    if (provider === 'slack') {
      return await postSlack(cfg.slackUrl, title, message)
    }
    return false
  } catch (err) {
    console.warn(`Webhook test failed for ${provider}:`, err)
    return false
  }
}
