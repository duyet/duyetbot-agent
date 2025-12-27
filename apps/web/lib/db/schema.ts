import type { InferSelectModel } from "drizzle-orm";
import {
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("User", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  password: text("password"),
  name: text("name"),
  githubId: text("githubId").unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = InferSelectModel<typeof user>;

export const chat: any = sqliteTable("Chat", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  title: text("title").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, {
      onDelete: "no action",
      onUpdate: "no action",
    }),
  visibility: text("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  // Chat branching fields
  parentChatId: text("parentChatId").references(() => chat.id, {
    onDelete: "set null",
    onUpdate: "no action",
  }),
  branchPoint: integer("branchPoint", { mode: "timestamp" }),
  // Chat sharing fields
  shareId: text("shareId").unique(),
  shareToken: text("shareToken"),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = sqliteTable("Message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  chatId: text("chatId")
    .notNull()
    .references(() => chat.id, {
      onDelete: "no action",
      onUpdate: "no action",
    }),
  role: text("role").notNull(),
  content: text("content", { mode: "json" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = sqliteTable("Message_v2", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  chatId: text("chatId")
    .notNull()
    .references(() => chat.id, {
      onDelete: "no action",
      onUpdate: "no action",
    }),
  role: text("role").notNull(),
  parts: text("parts", { mode: "json" }).notNull(),
  attachments: text("attachments", { mode: "json" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = sqliteTable(
  "Vote",
  {
    chatId: text("chatId")
      .notNull()
      .references(() => chat.id, {
        onDelete: "no action",
        onUpdate: "no action",
      }),
    messageId: text("messageId")
      .notNull()
      .references(() => messageDeprecated.id, {
        onDelete: "no action",
        onUpdate: "no action",
      }),
    isUpvoted: integer("isUpvoted", { mode: "boolean" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = sqliteTable(
  "Vote_v2",
  {
    chatId: text("chatId")
      .notNull()
      .references(() => chat.id, {
        onDelete: "no action",
        onUpdate: "no action",
      }),
    messageId: text("messageId")
      .notNull()
      .references(() => message.id, {
        onDelete: "no action",
        onUpdate: "no action",
      }),
    isUpvoted: integer("isUpvoted", { mode: "boolean" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = sqliteTable(
  "Document",
  {
    id: text("id").$defaultFn(() => crypto.randomUUID()),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: text("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, {
        onDelete: "no action",
        onUpdate: "no action",
      }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = sqliteTable(
  "Suggestion",
  {
    id: text("id").$defaultFn(() => crypto.randomUUID()),
    documentId: text("documentId").notNull(),
    documentCreatedAt: integer("documentCreatedAt", {
      mode: "timestamp",
    }).notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: integer("isResolved", { mode: "boolean" })
      .notNull()
      .default(false),
    userId: text("userId")
      .notNull()
      .references(() => user.id, {
        onDelete: "no action",
        onUpdate: "no action",
      }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = sqliteTable(
  "Stream",
  {
    id: text("id").$defaultFn(() => crypto.randomUUID()),
    chatId: text("chatId").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// Chat folders for organizing conversations
export const chatFolder = sqliteTable("ChatFolder", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, {
      onDelete: "cascade",
      onUpdate: "no action",
    }),
  color: text("color").notNull().default("#3b82f6"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ChatFolder = InferSelectModel<typeof chatFolder>;

// Chat to folder junction table
export const chatToFolder = sqliteTable(
  "ChatToFolder",
  {
    chatId: text("chatId")
      .notNull()
      .references(() => chat.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    folderId: text("folderId")
      .notNull()
      .references(() => chatFolder.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.folderId] }),
    };
  }
);

export type ChatToFolder = InferSelectModel<typeof chatToFolder>;

// Chat tags for labeling conversations
export const chatTag = sqliteTable("ChatTag", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, {
      onDelete: "cascade",
      onUpdate: "no action",
    }),
  color: text("color").notNull().default("#10b981"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ChatTag = InferSelectModel<typeof chatTag>;

// Chat to tag junction table
export const chatToTag = sqliteTable(
  "ChatToTag",
  {
    chatId: text("chatId")
      .notNull()
      .references(() => chat.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    tagId: text("tagId")
      .notNull()
      .references(() => chatTag.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.tagId] }),
    };
  }
);

export type ChatToTag = InferSelectModel<typeof chatToTag>;
