import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  UserHoverCard,
  ProjectHoverCard,
  KanbanCardHoverCard,
  ChannelHoverCard,
} from './hover-card.js';

describe('HoverCard Component', () => {
  it('renders trigger and shows content on hover', async () => {
    const user = userEvent.setup();
    render(
      <HoverCard openDelay={0} closeDelay={0}>
        <HoverCardTrigger asChild>
          <a href="#">Hover Me</a>
        </HoverCardTrigger>
        <HoverCardContent>Hover card details</HoverCardContent>
      </HoverCard>,
    );

    const trigger = screen.getByRole('link', { name: 'Hover Me' });
    await user.hover(trigger);

    expect(await screen.findByText('Hover card details')).toBeInTheDocument();
  });

  it('renders UserHoverCard preset correctly', async () => {
    const user = userEvent.setup();
    const mockUser = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'Engineer',
      status: 'online' as const,
      bio: 'Pioneer of computer programming.',
    };

    render(
      <UserHoverCard user={mockUser} openDelay={0} closeDelay={0}>
        <button>@ada</button>
      </UserHoverCard>,
    );

    const trigger = screen.getByRole('button', { name: '@ada' });
    await user.hover(trigger);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Engineer')).toBeInTheDocument();
    expect(screen.getByText('Pioneer of computer programming.')).toBeInTheDocument();
  });

  it('renders ProjectHoverCard preset correctly', async () => {
    const user = userEvent.setup();
    const mockProject = {
      name: 'Apollo Platform',
      identifier: 'APO-1',
      description: 'Next generation workspace architecture.',
      membersCount: 12,
    };

    render(
      <ProjectHoverCard project={mockProject} openDelay={0} closeDelay={0}>
        <span>Project Apollo</span>
      </ProjectHoverCard>,
    );

    await user.hover(screen.getByText('Project Apollo'));

    expect(await screen.findByText('Apollo Platform')).toBeInTheDocument();
    expect(screen.getByText('APO-1')).toBeInTheDocument();
    expect(screen.getByText('12 members')).toBeInTheDocument();
  });

  it('renders KanbanCardHoverCard preset correctly', async () => {
    const user = userEvent.setup();
    const mockCard = {
      title: 'Fix popover boundary collision',
      identifier: 'TASK-102',
      status: 'in progress',
      priority: 'high',
      assignee: 'Alan Turing',
    };

    render(
      <KanbanCardHoverCard card={mockCard} openDelay={0} closeDelay={0}>
        <span>Task 102</span>
      </KanbanCardHoverCard>,
    );

    await user.hover(screen.getByText('Task 102'));

    expect(await screen.findByText('Fix popover boundary collision')).toBeInTheDocument();
    expect(screen.getByText('TASK-102')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
  });

  it('renders ChannelHoverCard preset correctly', async () => {
    const user = userEvent.setup();
    const mockChannel = {
      name: 'announcements',
      description: 'Company-wide news and updates',
      isPrivate: false,
      membersCount: 48,
    };

    render(
      <ChannelHoverCard channel={mockChannel} openDelay={0} closeDelay={0}>
        <span>#announcements</span>
      </ChannelHoverCard>,
    );

    await user.hover(screen.getByText('#announcements'));

    expect(await screen.findByText('announcements')).toBeInTheDocument();
    expect(screen.getByText('Company-wide news and updates')).toBeInTheDocument();
    expect(screen.getByText('48 members')).toBeInTheDocument();
  });
});
