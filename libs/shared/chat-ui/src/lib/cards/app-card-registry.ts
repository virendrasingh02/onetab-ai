import type { AppResponseMessageContent, Message } from '@org/types';
import type { ReactNode } from 'react';

export type CustomAppCardRenderer = (props: {
  message: Message;
  event: AppResponseMessageContent;
  isOwn?: boolean;
}) => ReactNode;

class AppCardRegistry {
  private readonly renderers = new Map<string, CustomAppCardRenderer>();

  register(cardType: string, renderer: CustomAppCardRenderer): void {
    this.renderers.set(cardType.toLowerCase(), renderer);
  }

  unregister(cardType: string): void {
    this.renderers.delete(cardType.toLowerCase());
  }

  get(cardType?: string): CustomAppCardRenderer | undefined {
    if (!cardType) return undefined;
    return this.renderers.get(cardType.toLowerCase());
  }
}

export const appCardRegistry = new AppCardRegistry();
