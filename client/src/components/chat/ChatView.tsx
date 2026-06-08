import { useRef, useEffect, useCallback, useState } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { Send, Square, Plus, MessageSquareDashed } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addMessage,
  updateStreamingMessage,
  finalizeStreamingMessage,
  setStreamingMessageId,
  cancelConversation,
  setLoading,
  createConversation,
  syncCreateConversation,
  syncAddMessage,
  syncConversationStatus,
} from "@/store/slices/conversationsSlice";
import { llmCall, PUTER_MODELS } from "@/sdk/llmSdk";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { SettingsPanel } from "./SettingsPanel";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

export function ChatView (){
  const dispatch = useAppDispatch()
  const settings = useAppSelector((s) => s.settings)
  const conversations = useAppSelector((s) => s.conversations)
  const activeConv = conversations.items.find(
    (c) => c.id === conversations.activeConversationId
  )

  const [input, setInput] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingContentRef = useRef<string>("")

  const isLoading = conversations.isLoading
  const isCancelled = activeConv?.status === "cancelled"

  const modelLabel =
    PUTER_MODELS.find((m) => m.value === settings.defaultModel)?.label ??
    settings.defaultModel

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeConv?.messages])

  const buildConversation = useCallback(() => {
    const now = new Date().toISOString()
    return {
      id: nanoid(),
      title: "New Conversation",
      provider: "puter" as const,
      model: settings.defaultModel,
      messages: [],
      createdAt: now,
      updatedAt: now,
      status: "active" as const,
    }
  }, [settings.defaultModel])

  const startNewConversation = useCallback(() => {
    const conv = buildConversation()
    dispatch(createConversation("puter", settings.defaultModel))
    dispatch(syncCreateConversation(conv))
    setInput("")
  }, [dispatch, settings.defaultModel, buildConversation])

  // Create a conversation on first load if none exists
  useEffect(() => {
    if (conversations.items.length === 0) {
      const conv = buildConversation()
      dispatch(createConversation("puter", settings.defaultModel))
      dispatch(syncCreateConversation(conv))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    let currentConvId = conversations.activeConversationId

    if (!currentConvId || isCancelled) {
      const conv = buildConversation()
      dispatch({ type: "conversations/createConversation", payload: conv })
      dispatch(syncCreateConversation(conv))
      currentConvId = conv.id
    }

    setInput("")
    dispatch(setLoading(true))

    const userMsg: Message = {
      id: nanoid(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    }
    dispatch(addMessage({ conversationId: currentConvId, message: userMsg }))
    dispatch(syncAddMessage({ conversationId: currentConvId, message: userMsg }))

    const assistantMsgId = nanoid()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }
    dispatch(addMessage({ conversationId: currentConvId, message: assistantMsg }))
    dispatch(setStreamingMessageId(assistantMsgId))

    abortRef.current = new AbortController()
    streamingContentRef.current = ""

    const historyMessages = (
      conversations.items.find((c) => c.id === currentConvId)?.messages ?? []
    )
      .filter((m) => !m.isStreaming)
      .slice(-10)

    const allMessages: Message[] = [...historyMessages, userMsg]

    try {
      await llmCall(
        allMessages,
        currentConvId,
        {
          model: settings.defaultModel,
          streamingEnabled: settings.streamingEnabled,
          piiRedactionEnabled: settings.piiRedactionEnabled,
          dispatch,
        },
        (chunk) => {
          streamingContentRef.current += chunk
          dispatch(
            updateStreamingMessage({
              conversationId: currentConvId,
              messageId: assistantMsgId,
              content: streamingContentRef.current,
            })
          )
        },
        abortRef.current.signal
      )
    } catch {
      // Error already logged by SDK
    } finally {
      dispatch(
        finalizeStreamingMessage({
          conversationId: currentConvId,
          messageId: assistantMsgId,
        })
      )
      // Persist the completed assistant message
      const finalContent = streamingContentRef.current
      if (finalContent) {
        dispatch(syncAddMessage({
          conversationId: currentConvId,
          message: { ...assistantMsg, content: finalContent, isStreaming: false },
        }))
      }
      dispatch(setLoading(false))
    }
  }, [input, isLoading, settings, conversations, dispatch, isCancelled, buildConversation])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    if (conversations.activeConversationId) {
      dispatch(cancelConversation(conversations.activeConversationId))
      dispatch(syncConversationStatus({ id: conversations.activeConversationId, status: "cancelled" }))
    }
    dispatch(setLoading(false))
  }, [dispatch, conversations.activeConversationId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const messages = activeConv?.messages ?? []

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium max-w-xs">
              {activeConv?.title ?? "New Conversation"}
            </span>
            {activeConv && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {modelLabel}
              </span>
            )}
            {isCancelled && (
              <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                Cancelled
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={startNewConversation}
            className="shrink-0 gap-1.5"
          >
            <Plus className="size-3.5" />
            New Chat
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="flex flex-col gap-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                  <MessageSquareDashed className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Start a conversation</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    All inference metadata is captured automatically.
                    <br />
                    Puter will prompt you to sign in on first use.
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message… (Enter to send, Shift+Enter for newline)"
              className="min-h-11 max-h-32 resize-none text-sm"
              rows={1}
              disabled={isLoading && !isCancelled}
            />
            {isLoading ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={handleCancel}
                aria-label="Cancel"
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="Send"
              >
                <Send className="size-4" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {settings.streamingEnabled ? "Streaming" : "Non-streaming"} ·{" "}
            {settings.piiRedactionEnabled ? "PII redaction on" : "PII redaction off"} ·{" "}
            Powered by Puter.js
          </p>
        </div>
      </div>

      {/* Settings panel */}
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings((v) => !v)}
          className={cn("gap-1.5", showSettings && "bg-muted")}
        >
          Settings
        </Button>
        {showSettings && <SettingsPanel className="w-64" />}
      </div>
    </div>
  )
}