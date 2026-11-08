import { useEffect, useRef, useState } from 'react'
import { Ear, Mic, MicOff, Send, Sparkles, Square, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'framer-motion'
import { buildConversation, DEFAULT_OLLAMA_MODEL, pickInstalledModel, plannedToolCalls, runAgent, shouldUseModel, toHistory } from '../lib/agent'
import { AGENT_TOOLS, buildAgentContext, executeAgentTool, TOOL_LABELS } from '../lib/agentTools'
import { api } from '../lib/api'
import { scriptResponse } from '../lib/demo'
import { Speaker } from '../lib/speaker'
import { useVoiceInput } from '../lib/useVoiceInput'
import { extractWakeCommand, SentenceChunker, shouldContinueConversation, WAKE_PHRASES } from '../lib/voice'
import { useCyberStore } from '../store'
import type { AgentMessage, OllamaChatMessage, OllamaHealth } from '../types'

const quick = ['Run system check', 'Simulate breach', 'Show latest backup', 'Trace breach', 'Initiate Zero-Day Operation']
const OLLAMA_POLL_MS = 30000

export function AgentZero() {
  const { messages, addMessage, agentState, setAgentState, setSystemState, setPage, muted, setMuted, alwaysListening, setAlwaysListening, ollamaEndpoint, ollamaModel, setOllama, addActivity } = useCyberStore()
  const [input, setInput] = useState('')
  const [ollama, setOllamaHealth] = useState<OllamaHealth | null>(null)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [talking, setTalking] = useState(false)
  const [armed, setArmed] = useState(false)
  const [heard, setHeard] = useState('')
  const [generating, setGenerating] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [toolNote, setToolNote] = useState('')
  const feed = useRef<HTMLDivElement>(null)
  const armedRef = useRef(false)
  const generatingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const [speaker] = useState(() => new Speaker())

  useEffect(() => { void api().checkVoice().then(status => setVoiceSupported(status.available)) }, [])
  useEffect(() => {
    let alive = true
    const poll = async () => {
      const health = await api().checkOllama({ endpoint: ollamaEndpoint, model: ollamaModel })
      if (!alive) return
      const replacement = health.reachable && !health.available && ollamaModel === DEFAULT_OLLAMA_MODEL ? pickInstalledModel(health.models) : null
      if (replacement) {
        setOllama(ollamaEndpoint, replacement)
        addActivity(`Agent Zero is using ${replacement} because ${DEFAULT_OLLAMA_MODEL} is not installed`)
        return
      }
      setOllamaHealth(health)
    }
    void poll()
    const id = window.setInterval(() => void poll(), OLLAMA_POLL_MS)
    return () => { alive = false; window.clearInterval(id) }
  }, [ollamaEndpoint, ollamaModel, setOllama, addActivity])
  useEffect(() => { feed.current?.scrollTo({ top: feed.current.scrollHeight }) }, [messages, streamText, toolNote])

  const arm = (value: boolean) => { armedRef.current = value; setArmed(value) }
  const micEnabled = voiceSupported && (alwaysListening || talking)

  const voice = useVoiceInput(micEnabled, {
    onTranscript: text => {
      const wake = extractWakeCommand(text)
      if (talking || armedRef.current) {
        const command = wake.woke ? wake.command : text
        if (command) { arm(false); void respond(command) }
      } else if (wake.woke) {
        if (wake.command) void respond(wake.command)
        else { arm(true); setAgentState('Listening'); setHeard('Wake phrase heard — listening for your command…') }
      }
    },
    onFailure: (phase, detail) => {
      setAlwaysListening(false)
      setTalking(false)
      addActivity(phase === 'blocked' ? 'Microphone permission was not granted' : detail, 'warning')
    },
  })

  const settleAgentState = () => {
    const current = useCyberStore.getState().systemState
    setAgentState(current === 'SAFE' || current === 'MONITORING' ? 'Idle' : current === 'ISOLATED' ? 'Recovery Mode' : 'Critical Alert')
  }

  useEffect(() => {
    speaker.bind({
      voiceName: () => useCyberStore.getState().voiceName,
      muted: () => useCyberStore.getState().muted,
      onStart: () => { voice.pause(); setAgentState('Speaking') },
      onIdle: () => {
        settleAgentState()
        if (!armedRef.current) setTalking(false)
        voice.resume()
      },
    })
  })

  /** Closes out a reply: decides whether the next utterance is a follow-up, then lets the speaker drain. */
  const finishReply = (text: string) => {
    const currentState = useCyberStore.getState().systemState
    arm(shouldContinueConversation(text) || (currentState !== 'SAFE' && currentState !== 'MONITORING'))
    speaker.finish()
  }

  const speak = (text: string) => {
    speaker.begin()
    speaker.say(text)
    finishReply(text)
  }

  const stopReply = () => {
    abortRef.current?.abort()
    speaker.stop()
  }

  useEffect(() => { if (muted) speaker.stop() }, [muted, speaker])

  const speakRef = useRef(speak)
  useEffect(() => { speakRef.current = speak })
  useEffect(() => {
    const announce = (event: Event) => {
      const content = (event as CustomEvent<{ content?: string }>).detail?.content
      if (content) speakRef.current(content)
    }
    window.addEventListener('cyberzero:agent-announce', announce)
    return () => window.removeEventListener('cyberzero:agent-announce', announce)
  }, [])

  /** Runs the agent against the local model. Returns its reply, or null when the model failed. */
  const generate = async (prompt: string): Promise<string | null> => {
    const controller = new AbortController()
    abortRef.current = controller
    generatingRef.current = true
    setGenerating(true)
    const chunker = new SentenceChunker()
    let streamed = ''
    const chat = (conversation: OllamaChatMessage[]) => {
      const requestId = crypto.randomUUID()
      const cancel = () => void api().cancelOllama(requestId)
      controller.signal.addEventListener('abort', cancel, { once: true })
      return api().chatOllama({ requestId, endpoint: ollamaEndpoint, model: ollamaModel, messages: conversation, tools: ollama?.toolsSupported ? AGENT_TOOLS : undefined }, delta => {
        if (controller.signal.aborted) return
        streamed += delta
        setToolNote('')
        setStreamText(streamed)
        chunker.push(delta).forEach(sentence => speaker.say(sentence))
      }).finally(() => controller.signal.removeEventListener('abort', cancel))
    }
    try {
      const reply = await runAgent({ chat, executeTool: executeAgentTool, messages: buildConversation(toHistory(useCyberStore.getState().messages), buildAgentContext()), plannedCalls: ollama?.toolsSupported ? plannedToolCalls(prompt) : [], onToolCall: name => setToolNote(TOOL_LABELS[name] ?? 'Working') })
      if (streamed.trim()) speaker.say(chunker.flush())
      else speaker.say(reply)
      return reply
    } catch {
      if (controller.signal.aborted) return streamed.trim()
      setOllamaHealth(current => current && { ...current, available: false, detail: 'The local model stopped responding — Demo Script Mode active' })
      addActivity('Local model request failed; Agent Zero fell back to Demo Script', 'warning')
      return null
    } finally {
      abortRef.current = null
      generatingRef.current = false
      setGenerating(false)
      setStreamText('')
      setToolNote('')
    }
  }

  const respond = async (raw: string) => {
    const prompt = raw.trim()
    if (!prompt || generatingRef.current) return
    speaker.stop({ notify: false })
    voice.pause()
    setHeard('')
    addMessage({ id: crypto.randomUUID(), role: 'user', content: prompt, source: 'USER', createdAt: new Date().toISOString() })
    setInput('')
    setAgentState('Thinking')
    const lastAssistant = [...useCyberStore.getState().messages].reverse().find(m => m.role === 'assistant')
    const scripted = scriptResponse(prompt)
    if (scripted.action === 'breach') { setSystemState('BREACH_DETECTED'); setAgentState('Critical Alert'); addActivity('Operation Nightfall breach simulation started', 'critical') }
    if (scripted.action === 'authorize') { setSystemState('AWAITING_CEO_AUTHORIZATION'); setAgentState('Awaiting Authorization'); window.dispatchEvent(new CustomEvent('cyberzero:authorize')) }
    if (scripted.action === 'trace') { setSystemState('TRACING'); setPage('detection') }
    if (scripted.action === 'backup') setPage('backup')
    if (scripted.action === 'monitor') setSystemState('MONITORING')

    speaker.begin()
    let content = scripted.content
    let source: AgentMessage['source'] = 'SCRIPTED_DEMO'
    const reply = ollama?.available && shouldUseModel(scripted, lastAssistant?.source) ? await generate(prompt) : null
    if (reply !== null) {
      content = reply
      source = 'OLLAMA'
    } else {
      await new Promise(resolve => setTimeout(resolve, 450))
      speaker.say(content)
    }
    if (content) addMessage({ id: crypto.randomUUID(), role: 'assistant', content, source, createdAt: new Date().toISOString() })
    if (scripted.action === 'execute') {
      window.dispatchEvent(new CustomEvent('cyberzero:authorize'))
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('cyberzero:voice-code', { detail: { code: '4256UTD' } })), 80)
    }
    finishReply(content)
  }

  const toggleWakeListening = () => {
    if (!voiceSupported) return
    setAlwaysListening(!alwaysListening)
    if (alwaysListening) { setHeard(''); arm(false) }
    addActivity(!alwaysListening ? 'Wake-word listening enabled' : 'Wake-word listening disabled')
  }

  const toggleTalk = () => {
    if (talking) { setTalking(false); arm(false); return }
    stopReply()
    setTalking(true)
    setAgentState('Listening')
  }

  const busy = generating || agentState === 'Speaking'
  const listeningForCommand = armed || talking
  const banner = !voiceSupported ? { title: 'Voice input needs the desktop app', hint: 'Agent Zero can still speak and answer typed requests' }
    : voice.phase === 'blocked' ? { title: 'Microphone access blocked', hint: voice.detail }
    : voice.phase === 'error' ? { title: 'Voice unavailable', hint: voice.detail }
    : voice.phase === 'loading' ? { title: 'Preparing local voice model', hint: voice.detail || 'Audio stays on this device' }
    : voice.phase === 'hearing' ? { title: 'Hearing you…', hint: 'Pause when you finish speaking' }
    : voice.phase === 'transcribing' ? { title: 'Transcribing on this device…', hint: 'Audio never leaves this computer' }
    : listeningForCommand && micEnabled ? { title: 'Listening for your command', hint: 'Speak now' }
    : alwaysListening ? { title: 'Wake listening is active', hint: `Say “${WAKE_PHRASES[0]}” or “${WAKE_PHRASES[2]}”` }
    : { title: 'Wake listening is off', hint: 'Enable to start Agent Zero hands-free' }

  return <section className="panel agent-panel">
    <div className="agent-header"><div className="zero-orb-wrap"><motion.div className={`zero-orb ${agentState === 'Critical Alert' ? 'critical' : ''}`} animate={{ scale: agentState === 'Speaking' ? [1, 1.1, .97, 1.06, 1] : [1, 1.035, 1] }} transition={{ repeat: Infinity, duration: agentState === 'Speaking' ? 1.3 : 3 }}><Sparkles size={22}/></motion.div><span className="online-dot"/></div><div><span className="eyebrow">LOCAL INCIDENT ASSISTANT</span><h2>Agent Zero</h2></div><div className="agent-status"><span>{agentState}</span><small>{ollama?.available ? `AI · ${ollamaModel}` : 'Demo Script · Deterministic'}</small></div><button className="icon-button" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute voice' : 'Mute voice'}>{muted ? <VolumeX/> : <Volume2/>}</button></div>
    <div className={`wake-listening ${micEnabled ? 'enabled' : ''} ${listeningForCommand && micEnabled ? 'awake' : ''}`}><div><Ear size={15}/><span><strong>{banner.title}</strong><small>{banner.hint}</small></span></div><button onClick={toggleWakeListening} disabled={!voiceSupported}>{alwaysListening ? <Mic size={15}/> : <MicOff size={15}/>} {alwaysListening ? 'Listening' : 'Enable'}</button>{micEnabled && heard && <p>{heard}</p>}</div>
    <div className="message-feed" ref={feed} aria-live="polite">{messages.map(m => <div key={m.id} className={`message ${m.role}`}><div>{m.content}</div><span>{m.role === 'assistant' ? (m.source === 'OLLAMA' ? 'AI · LOCAL' : 'DEMO SCRIPT') : 'YOU'}</span></div>)}{generating && <div className="message assistant streaming"><div>{streamText || <em>{toolNote ? `${toolNote}…` : 'Thinking…'}</em>}</div><span>AI · LOCAL</span></div>}</div>
    <div className="quick-actions">{quick.map(q => <button key={q} disabled={generating} onClick={() => void respond(q)}>{q}</button>)}</div>
    <form className="agent-input" onSubmit={e => { e.preventDefault(); void respond(input) }}><button type="button" className={`icon-button ${talking ? 'mic-active' : ''}`} onClick={toggleTalk} disabled={!voiceSupported} aria-pressed={talking} aria-label={talking ? 'Stop talking to Agent Zero' : 'Talk to Agent Zero'} title={voiceSupported ? 'Talk to Agent Zero without a wake phrase' : 'Voice input needs the desktop app'}>{talking ? <Mic/> : <MicOff/>}</button><input placeholder="Ask Zero or type a demo command…" value={input} onChange={e => setInput(e.target.value)}/>{busy ? <button type="button" className="send-button stop-button" onClick={stopReply} aria-label="Stop Agent Zero"><Square size={16}/></button> : <button className="send-button" aria-label="Send"><Send size={18}/></button>}</form>
  </section>
}
