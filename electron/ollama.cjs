const REQUEST_TIMEOUT_MS = 120000
const MAX_MESSAGES = 40
const MAX_CONTENT_CHARS = 8000
const ROLES = new Set(['system', 'user', 'assistant', 'tool'])
const OFFLINE = 'Ollama unavailable — Demo Script Mode active'

function localEndpoint(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Only local Ollama endpoints are allowed')
  return url
}

const isValidModel = (model) => typeof model === 'string' && /^[a-zA-Z0-9._:/-]{1,100}$/.test(model)

async function checkOllama(input) {
  const unreachable = (detail) => ({ available: false, reachable: false, toolsSupported: false, detail, models: [] })
  let response
  try {
    response = await fetch(new URL('/api/tags', localEndpoint(input?.endpoint)), { redirect: 'error', signal: AbortSignal.timeout(1800) })
  } catch {
    return unreachable(OFFLINE)
  }
  if (!response.ok) return unreachable(`Ollama returned HTTP ${response.status}`)
  const body = await response.json()
  const models = (body.models ?? []).map(model => ({ name: model.name, tools: model.capabilities ? model.capabilities.includes('tools') : true }))
  const selected = models.find(model => model.name === input.model || model.name === `${input.model}:latest`)
  if (!selected) return { available: false, reachable: true, toolsSupported: false, models, detail: models.length ? `Model "${input.model}" is not installed. Choose an installed model.` : 'Ollama is running but has no models. Run: ollama pull qwen3:4b' }
  return { available: true, reachable: true, toolsSupported: selected.tools, models, detail: selected.tools ? `Connected to ${selected.name}` : `Connected to ${selected.name}. This model cannot use tools, so Agent Zero can answer but not act.` }
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) throw new Error('Chat messages are invalid')
  return messages.map(message => {
    if (!ROLES.has(message?.role)) throw new Error('Chat messages are invalid')
    const clean = { role: message.role, content: String(message.content ?? '').slice(0, MAX_CONTENT_CHARS) }
    if (typeof message.tool_name === 'string') clean.tool_name = message.tool_name.slice(0, 64)
    if (Array.isArray(message.tool_calls)) clean.tool_calls = message.tool_calls
    return clean
  })
}

async function streamChat(input, onDelta, signal) {
  if (!isValidModel(input?.model)) throw new Error('Ollama model name is invalid')
  const response = await fetch(new URL('/api/chat', localEndpoint(input.endpoint)), {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: input.model, messages: sanitizeMessages(input.messages), tools: Array.isArray(input.tools) && input.tools.length ? input.tools : undefined, stream: true, think: false, keep_alive: '15m' }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  })
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`)

  let content = ''
  const toolCalls = []
  const handleLine = (line) => {
    if (!line.trim()) return
    const chunk = JSON.parse(line)
    if (chunk.error) throw new Error(`Ollama error: ${chunk.error}`)
    if (chunk.message?.content) { content += chunk.message.content; onDelta(chunk.message.content) }
    if (Array.isArray(chunk.message?.tool_calls)) toolCalls.push(...chunk.message.tool_calls)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    lines.forEach(handleLine)
  }
  handleLine(buffer + decoder.decode())
  return { content, toolCalls }
}

module.exports = { checkOllama, streamChat }
