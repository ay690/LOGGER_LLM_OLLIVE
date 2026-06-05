import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { Conversation, Message, Provider } from "@/types"
import { nanoid } from "@reduxjs/toolkit"

interface ConversationsState {
  items: Conversation[]
  activeConversationId: string | null
  isLoading: boolean
  streamingMessageId: string | null
}

const initialState: ConversationsState = {
  items: [],
  activeConversationId: null,
  isLoading: false,
  streamingMessageId: null,
}

const conversationsSlice = createSlice({
  name: "conversations",
  initialState,
  reducers: {
    createConversation: {
      reducer(state, action: PayloadAction<Conversation>) {
        state.items.unshift(action.payload)
        state.activeConversationId = action.payload.id
      },
      prepare(provider: Provider, model: string) {
        const id = nanoid()
        const now = new Date().toISOString()
        return {
          payload: {
            id,
            title: "New Conversation",
            provider,
            model,
            messages: [],
            createdAt: now,
            updatedAt: now,
            status: "active" as const,
          },
        }
      },
    },

    setActiveConversation(state, action: PayloadAction<string>) {
      state.activeConversationId = action.payload
    },

    addMessage(
      state,
      action: PayloadAction<{ conversationId: string; message: Message }>
    ) {
      const conv = state.items.find((c) => c.id === action.payload.conversationId)
      if (conv) {
        conv.messages.push(action.payload.message)
        conv.updatedAt = new Date().toISOString()
        // Auto-title from first user message
        if (conv.messages.length === 1 && action.payload.message.role === "user") {
          conv.title =
            action.payload.message.content.slice(0, 40) +
            (action.payload.message.content.length > 40 ? "…" : "")
        }
      }
    },

    updateStreamingMessage(
      state,
      action: PayloadAction<{
        conversationId: string
        messageId: string
        content: string
      }>
    ) {
      const conv = state.items.find((c) => c.id === action.payload.conversationId)
      if (conv) {
        const msg = conv.messages.find((m) => m.id === action.payload.messageId)
        if (msg) {
          msg.content = action.payload.content
        }
      }
    },

    finalizeStreamingMessage(
      state,
      action: PayloadAction<{ conversationId: string; messageId: string }>
    ) {
      const conv = state.items.find((c) => c.id === action.payload.conversationId)
      if (conv) {
        const msg = conv.messages.find((m) => m.id === action.payload.messageId)
        if (msg) {
          msg.isStreaming = false
        }
      }
      state.streamingMessageId = null
    },

    setStreamingMessageId(state, action: PayloadAction<string | null>) {
      state.streamingMessageId = action.payload
    },

    cancelConversation(state, action: PayloadAction<string>) {
      const conv = state.items.find((c) => c.id === action.payload)
      if (conv) {
        conv.status = "cancelled"
        // Remove any in-progress streaming message
        conv.messages = conv.messages.filter((m) => !m.isStreaming)
      }
      state.streamingMessageId = null
      state.isLoading = false
    },

    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload
    },

    deleteConversation(state, action: PayloadAction<string>) {
      state.items = state.items.filter((c) => c.id !== action.payload)
      if (state.activeConversationId === action.payload) {
        state.activeConversationId = state.items[0]?.id ?? null
      }
    },
  },
})

export const {
  createConversation,
  setActiveConversation,
  addMessage,
  updateStreamingMessage,
  finalizeStreamingMessage,
  setStreamingMessageId,
  cancelConversation,
  setLoading,
  deleteConversation,
} = conversationsSlice.actions

export default conversationsSlice.reducer;