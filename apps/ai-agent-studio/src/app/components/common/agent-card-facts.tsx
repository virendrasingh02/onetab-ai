import { appLabel } from '@org/types';
import { Hint } from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { BookOpen, Bot, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppConnectorIcon } from './app-connector-icon.jsx';
import type {
  AgentContents,
  AgentContentsTool,
  AgentVersionSummary,
} from './agent-contents.js';
import { plural } from './ai-entity-summary.js';
import { EntityCount } from './entity-card.js';

const MAX_LISTED = 12;
const MAX_LOGOS = 3;

/** Names for a tooltip, the rest folded into "+N more" so it stays on screen. */
function NameList({ names }: { names: string[] }) {
  const extra = names.length - MAX_LISTED;
  return (
    <ul className="space-y-0.5">
      {names.slice(0, MAX_LISTED).map((name, i) => (
        <li key={`${name}-${i}`}>{name}</li>
      ))}
      {extra > 0 && <li className="text-muted-foreground">+{extra} more</li>}
    </ul>
  );
}

function HintTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1 font-semibold">{children}</p>;
}

/** Tool names under their app; built-in tools come first. */
function ToolsHint({ tools }: { tools: AgentContentsTool[] }) {
  const groups = new Map<string, string[]>();
  for (const tool of [...tools].sort(
    (a, b) => Number(!!a.provider) - Number(!!b.provider),
  )) {
    const group = tool.provider ? appLabel(tool.provider) : 'Built-in';
    groups.set(group, [...(groups.get(group) ?? []), tool.label]);
  }
  let remaining = MAX_LISTED;
  const shown = [...groups].flatMap(([group, names]) => {
    const visible = names.slice(0, Math.max(remaining, 0));
    remaining -= visible.length;
    return visible.length ? [{ group, names: visible }] : [];
  });
  const extra = tools.length - MAX_LISTED;

  return (
    <div className="py-0.5 space-y-1.5">
      {shown.map(({ group, names }) => (
        <div key={group}>
          <p className="font-semibold">{group}</p>
          <ul className="text-muted-foreground">
            {names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      ))}
      {extra > 0 && <p className="text-muted-foreground">+{extra} more</p>}
    </div>
  );
}

/** The agent's tools, apps, knowledge and team; each lists its names on hover. */
export function AgentContentsFacts({ contents }: { contents: AgentContents }) {
  const { tools, apps, knowledge, agents } = contents;
  const extraApps = apps.length - MAX_LOGOS;

  return (
    <>
      <EntityCount
        icon={<Wrench />}
        count={tools.length}
        label={plural(tools.length, 'tool')}
        hint={tools.length ? <ToolsHint tools={tools} /> : undefined}
      />
      {apps.length > 0 && (
        <Hint
          label={
            <div className="py-0.5">
              <HintTitle>
                Connects to {apps.length} {plural(apps.length, 'app')}
              </HintTitle>
              <NameList names={apps.map(appLabel)} />
            </div>
          }
        >
          <span
            tabIndex={0}
            aria-label={`Apps: ${apps.map(appLabel).join(', ')}`}
            className="gap-1 pointer-events-auto inline-flex shrink-0 items-center rounded-sm text-2xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {apps.slice(0, MAX_LOGOS).map((app) => (
              <AppConnectorIcon
                key={app}
                connectorId={app.toLowerCase()}
                name={appLabel(app)}
                size={14}
              />
            ))}
            {extraApps > 0 && <span>+{extraApps}</span>}
          </span>
        </Hint>
      )}
      {knowledge.length > 0 && (
        <EntityCount
          icon={<BookOpen />}
          count={knowledge.length}
          label={plural(knowledge.length, 'source')}
          hint={
            <div className="py-0.5">
              <HintTitle>Knowledge</HintTitle>
              <NameList names={knowledge} />
            </div>
          }
        />
      )}
      {agents.length > 1 && (
        <EntityCount
          icon={<Bot />}
          count={agents.length}
          label="agents"
          hint={
            <div className="py-0.5">
              <HintTitle>Agents on the canvas</HintTitle>
              <NameList names={agents} />
            </div>
          }
        />
      )}
    </>
  );
}

/** The agent's version chip. Dashed until a version has been published. */
export function AgentVersionChip({
  version,
}: {
  version: AgentVersionSummary | null;
}) {
  const chip = cn(
    'px-1.5 py-0.5 font-medium pointer-events-auto inline-flex rounded-md border text-2xs tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    version?.published
      ? 'border-border/60 bg-surface-raised text-foreground'
      : 'border-dashed border-border text-muted-foreground',
  );

  if (!version)
    return (
      <Hint label="Nothing saved yet. Publishing creates the first version.">
        <span tabIndex={0} className={chip}>
          No version
        </span>
      </Hint>
    );

  return (
    <Hint
      label={
        <div className="py-0.5 space-y-0.5">
          <p className="font-semibold">
            {version.published
              ? `${version.label} is the published version`
              : `${version.label} is saved, not published`}
          </p>
          {version.publishedAt && (
            <p className="text-muted-foreground">
              Published {formatRelative(version.publishedAt)}
            </p>
          )}
          {version.newerSnapshot && (
            <p className="text-muted-foreground">
              Newer snapshot: {version.newerSnapshot}
            </p>
          )}
          <p className="text-muted-foreground">
            {version.total} {plural(version.total, 'version')} saved
          </p>
        </div>
      }
    >
      <span
        tabIndex={0}
        aria-label={`Version ${version.label}${version.published ? '' : ', not published'}`}
        className={chip}
      >
        {version.label}
      </span>
    </Hint>
  );
}
