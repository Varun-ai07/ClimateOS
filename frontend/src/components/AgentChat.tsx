import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

interface Message {
  id: string
  agent: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  timestamp: Date
}

interface Props {
  agent: string
  messages: Message[]
  isTyping: boolean
}

const AGENT_AVATARS: Record<string, { icon: React.ReactNode; color: string }> = {
  integrity_agent: {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    color: 'var(--decided)',
  },
  engagement_agent: {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    color: 'var(--thinking)',
  },
}

const TYPE_STYLES: Record<string, { bg: string; border: string }> = {
  info: { bg: 'bg-neutral-light', border: 'border-primary/30' },
  warning: { bg: 'bg-acting/10', border: 'border-acting/30' },
  success: { bg: 'bg-decided/10', border: 'border-decided/30' },
  error: { bg: 'bg-alert/10', border: 'border-alert/30' },
}

export default function AgentChat({ agent, messages, isTyping }: Props) {
  const avatar = AGENT_AVATARS[agent] || AGENT_AVATARS.integrity_agent

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto p-3">
      <AnimatePresence>
        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
            className="flex gap-3"
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: avatar.color }}
            >
              {avatar.icon}
            </div>

            {/* Message bubble */}
            <div className={`flex-1 p-3 rounded-lg border ${TYPE_STYLES[msg.type].bg} ${TYPE_STYLES[msg.type].border}`}>
              <div className="text-sm text-text">{msg.content}</div>
              <div className="text-xs text-idle mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Typing indicator */}
      {isTyping && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: avatar.color }}
          >
            {avatar.icon}
          </div>
          <div className="bg-neutral-light border border-primary/30 rounded-lg px-4 py-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-idle"
                  animate={{
                    y: [0, -6, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}