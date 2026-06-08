import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import type { Conversation, Message, Provider } from "@/types"
import { nanoid } from "@reduxjs/toolkit"
import { conversationsApi } from "@/api/client"

interface ConversationsState {
  items: Conversation[]
  activeConversationId: string | null
  isLoading: boolean
  streamingMessageId: string | null
  syncing: boolean // true while any API call is in-flight
}

const initialState: ConversationsState = {
  items: [],
  activeConversationId: null,
  isLoading: false,
  streamingMessageId: null,
  syncing: false,
}

// ─── Async thunks ─────────────────────────────────────────────────────────────

/** Load all conversations from the backend on app start. */
export const loadConversations = createAsyncThunk(
  "conversations/loadConversations",
  async () => {
    const { data } = await conversationsApi.list()
    return data
  }
)

/** Persist a newly created conversation to the backend. */
export const syncCreateConversation = createAsyncThunk(
  "conversations/syncCreate",
  async (conv: Conversation) => {
    await conversationsApi.create({
      id: conv.id,
      title: conv.title,
      model: conv.model,
      provider: conv.provider,
      status: conv.status,
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    })
  }
)

/** Persist a new message to the backend. */
export const syncAddMessage = createAsyncThunk(
  "conversations/syncAddMessage",
  async ({ conversationId, message }: { conversationId: string; message: Message }) => {
    await conversationsApi.addMessage(conversationId, {
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    })
  }
)

/** Persist a status change (cancel / complete) to the backend. */
export const syncConversationStatus = createAsyncThunk(
  "conversations/syncStatus",
  async ({ id, status }: { id: string; status: "active" | "cancelled" | "completed" }) => {
    await conversationsApi.updateStatus(id, status)
  }
)

/** Delete a conversation from the backend. */
export const syncDeleteConversation = createAsyncThunk(
  "conversations/syncDelete",
  async (id: string) => {
    await conversationsApi.delete(id)
  }
)

// ─── Slice ────────────────────────────────────────────────────────────────────
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

  extraReducers: (builder) => {
    // loadConversations
    builder
      .addCase(loadConversations.pending, (state) => { state.syncing = true })
      .addCase(loadConversations.fulfilled, (state, action) => {
        state.syncing = false
        // Map API shape (llmModel) back to frontend shape (model)
        state.items = action.payload.map((c) => ({
          id: c._id,
          title: c.title,
          model: c.llmModel,
          provider: c.provider as Provider,
          status: c.status,
          messages: (c.messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as Message["role"],
            content: m.content,
            timestamp: m.timestamp,
          })),
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }))
        // Restore activeConversationId to first item if not already set
        if (!state.activeConversationId && state.items.length > 0) {
          state.activeConversationId = state.items[0].id
        }
      })
      .addCase(loadConversations.rejected, (state) => { state.syncing = false })

    // syncCreateConversation, syncAddMessage, syncConversationStatus, syncDeleteConversation
    // These are fire-and-forget from the UI's perspective (optimistic updates already applied).
    // We just track syncing flag for debugging.
    builder
      .addCase(syncCreateConversation.pending, (state) => { state.syncing = true })
      .addCase(syncCreateConversation.fulfilled, (state) => { state.syncing = false })
      .addCase(syncCreateConversation.rejected, (state) => { state.syncing = false })
      .addCase(syncAddMessage.pending, (state) => { state.syncing = true })
      .addCase(syncAddMessage.fulfilled, (state) => { state.syncing = false })
      .addCase(syncAddMessage.rejected, (state) => { state.syncing = false })
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

export default conversationsSlice.reducer
