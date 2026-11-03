-- Max width of the chat timeline + composer column on large screens.
ALTER TABLE "chat_settings" ADD COLUMN "contentWidth" TEXT NOT NULL DEFAULT 'full';
