import { createContext, useContext, type ReactNode } from 'react';

/** A name a person used to go by, and who they are now. */
export interface MentionAlias {
  /** Platform user id (also accepts the Matrix spelling). */
  userId: string;
  alias: string;
}

const NO_ALIASES: readonly MentionAlias[] = [];

const MentionAliasesContext = createContext<readonly MentionAlias[]>(NO_ALIASES);

/**
 * Supplies former names to every message below it, so `@Old Name` written
 * before a rename still renders as the person's current name.
 */
export function MentionAliasesProvider({
  aliases,
  children,
}: {
  aliases: readonly MentionAlias[] | undefined;
  children: ReactNode;
}) {
  return (
    <MentionAliasesContext.Provider value={aliases ?? NO_ALIASES}>
      {children}
    </MentionAliasesContext.Provider>
  );
}

export function useMentionAliases(): readonly MentionAlias[] {
  return useContext(MentionAliasesContext);
}
