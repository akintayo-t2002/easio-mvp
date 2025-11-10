import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  TrackReferenceOrPlaceholder,
  useChat,
  useLocalParticipant,
  useTrackTranscription,
  useTracks,
  useRoomContext,
} from "@livekit/components-react"
import { LocalParticipant, Participant, Track, TranscriptionSegment } from "livekit-client"

import { TypingIndicator } from "./TypingIndicator"

interface ChatPanelProps {
  accentColorClass?: string
  canSend: boolean
  isConnecting?: boolean
}

type ChatEntry = {
  id: string
  name: string
  message: string
  isSelf: boolean
  timestamp: number
  isAgent: boolean
  interim?: boolean
}

export function ChatPanel({ accentColorClass = "text-blue-600", canSend, isConnecting = false }: ChatPanelProps) {
  const { chatMessages, send } = useChat()
  const localParticipant = useLocalParticipant()
  const tracks = useTracks()
  const room = useRoomContext()

  const [isAgentThinking, setIsAgentThinking] = useState(false)
  const [lastUserMessageTime, setLastUserMessageTime] = useState(0)
  const [hasAgentContent, setHasAgentContent] = useState(false)
  const readySentRef = useRef(false)

  const agentAudioTrack = useMemo<TrackReferenceOrPlaceholder | undefined>(() => {
    return tracks.find(
      (trackRef) =>
        trackRef.participant instanceof Participant &&
        !(trackRef.participant instanceof LocalParticipant) &&
        trackRef.publication.kind === Track.Kind.Audio,
    )
  }, [tracks])

  const agentSegments = useTrackTranscription(agentAudioTrack)
  const localSegments = useTrackTranscription(
    localParticipant.localParticipant
      ? {
          publication: localParticipant.microphoneTrack,
          source: Track.Source.Microphone,
          participant: localParticipant.localParticipant,
        }
      : undefined,
  )

  const transcriptEntries = useMemo(() => {
    const entries = new Map<string, ChatEntry>()

    if (agentAudioTrack?.participant) {
      agentSegments.segments.forEach((segment) => {
        entries.set(
          segment.id,
          segmentToEntry(segment, agentAudioTrack.participant, {
            label: "Agent",
            isSelf: false,
            isAgent: true,
          }),
        )
      })
    }

    if (localParticipant.localParticipant) {
      localSegments.segments.forEach((segment) => {
        entries.set(
          segment.id,
          segmentToEntry(segment, localParticipant.localParticipant, {
            label: "You",
            isSelf: true,
            isAgent: false,
          }),
        )
      })
    }

    return entries
  }, [agentAudioTrack?.participant, agentSegments.segments, localParticipant.localParticipant, localSegments.segments])

  const messages = useMemo(() => {
    const agentIdentity = agentAudioTrack?.participant?.identity
    const localIdentity = localParticipant.localParticipant?.identity

    // Show agent interim transcripts for streaming effect, hide user interim to avoid duplicates
    const merged: ChatEntry[] = [...transcriptEntries.values()].filter(entry => !entry.interim || entry.isAgent)

    for (const message of chatMessages) {
      const identity = message.from?.identity
      const isSelf = identity === localIdentity
      const isAgent = identity === agentIdentity || (!identity && !isSelf)
      const name = message.from?.name || (isAgent ? "Agent" : isSelf ? "You" : "Participant")

      merged.push({
        id: `chat-${message.id ?? message.timestamp}`,
        name,
        message: message.message,
        timestamp: message.timestamp,
        isSelf,
        isAgent,
      })
    }

    // Sort by timestamp to ensure proper chronological order
    merged.sort((a, b) => a.timestamp - b.timestamp)
    return merged
  }, [agentAudioTrack?.participant?.identity, chatMessages, localParticipant.localParticipant?.identity, transcriptEntries])

  useEffect(() => {
    if (!hasAgentContent) {
      const agentMessage = messages.find(
        (entry) => entry.isAgent && entry.message && entry.message.trim().length > 0,
      )
      if (agentMessage) {
        setHasAgentContent(true)
      }
    }
  }, [hasAgentContent, messages])

  useEffect(() => {
    if (isConnecting) {
      setHasAgentContent(false)
    }
  }, [isConnecting])

  // Detect when agent responds to clear thinking indicator
  useEffect(() => {
    if (isAgentThinking && lastUserMessageTime > 0) {
      const recentAgentMessage = messages.find(
        m => m.isAgent && m.timestamp > lastUserMessageTime
      )
      if (recentAgentMessage) {
        setIsAgentThinking(false)
      }
    }
  }, [messages, isAgentThinking, lastUserMessageTime])

  // Fallback timeout to clear thinking indicator
  useEffect(() => {
    if (isAgentThinking) {
      const timer = setTimeout(() => setIsAgentThinking(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [isAgentThinking])

  const containerRef = useRef<HTMLDivElement>(null)
  
  // Robust scroll-to-bottom function using requestAnimationFrame
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
      }
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isAgentThinking, isConnecting, scrollToBottom])

  useEffect(() => {
    if (readySentRef.current) {
      return
    }

    const publication = agentAudioTrack?.publication
    if (!agentAudioTrack || !publication) {
      return
    }

    const isSubscribed =
      typeof (publication as { subscribed?: boolean }).subscribed === "boolean"
        ? Boolean((publication as { subscribed?: boolean }).subscribed)
        : true

    if (!isSubscribed) {
      return
    }

    readySentRef.current = true

    void room.localParticipant
      .publishData(JSON.stringify({ type: "ready_to_listen" }), { reliable: true })
      .catch((error: unknown) => {
        console.error("Failed to send ready_to_listen signal", error)
      })
  }, [agentAudioTrack, room])

  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!input.trim() || !canSend || sending) {
      return
    }

    const message = input.trim()
    setSending(true)

    void (async () => {
      try {
        await send(message)
        setInput("")
        // Show thinking indicator after user sends message
        setIsAgentThinking(true)
        setLastUserMessageTime(Date.now())
      } catch (error) {
        console.error("Failed to send chat message", error)
        setInput(message)
      } finally {
        setSending(false)
      }
    })()
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Test Conversation</h3>
          <p className="text-xs text-text-secondary">Start chatting to test this workflow</p>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages
          .filter(entry => entry.message && entry.message.trim().length > 0)
          .map((entry) => (
            <div key={entry.id} className={`flex flex-col ${entry.isSelf ? "items-end" : "items-start"}`}>
              <span className={`text-xs font-semibold ${entry.isSelf ? "text-text-secondary" : accentColorClass}`}>
                {entry.name}
              </span>
              <div
                className={`mt-1 max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  entry.isSelf
                    ? "bg-background-secondary text-text-primary"
                    : "bg-background text-text-primary border border-border"
                } ${entry.interim ? "opacity-70" : ""}`}
              >
                {entry.message}
              </div>
            </div>
          ))}
        {((!hasAgentContent && !isConnecting) || isAgentThinking || isConnecting) && <TypingIndicator />}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border bg-background-secondary/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={canSend ? "Type a message" : "Waiting for connection..."}
            disabled={!canSend || sending}
            className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary shadow-sm disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canSend || sending || !input.trim()}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity ${
              !canSend || sending || !input.trim() ? "bg-gray-400" : "bg-black hover:opacity-90"
            }`}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  )
}

function segmentToEntry(
  segment: TranscriptionSegment,
  participant: Participant,
  metadata: { label: string; isSelf: boolean; isAgent: boolean },
): ChatEntry {
  // Use firstReceivedTime for more accurate ordering, fallback to timestamp
  const time = segment.firstReceivedTime ?? segment.timestamp ?? Date.now()
  return {
    id: `segment-${segment.id}`,
    name: metadata.label,
    message: segment.final ? segment.text : `${segment.text} …`,
    timestamp: time,
    isSelf: metadata.isSelf,
    isAgent: metadata.isAgent,
    interim: !segment.final,
  }
}
