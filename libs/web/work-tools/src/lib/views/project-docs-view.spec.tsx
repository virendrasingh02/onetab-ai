// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDocsView } from './ProjectDocsView.js';
import type { ProjectDetail } from '@org/types';
import { ProjectStatus } from '@org/types';
import type { DocItem } from '../docs/doc-types.js';

describe('ProjectDocsView', () => {
  const mockProject: ProjectDetail = {
    id: 'proj-1',
    workspaceId: 'ws-1',
    name: 'Unified Workspace Platform',
    slug: 'unified-workspace',
    status: ProjectStatus.ACTIVE,
    ticketPrefix: 'UWP',
    _count: { tasks: 12 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as ProjectDetail;

  const mockDocs: DocItem[] = [
    {
      id: 'doc-1',
      companyId: 'comp-1',
      title: 'UWP PRD & Technical Spec',
      category: 'Engineering',
      updatedAt: 'Just now',
      snippet: 'Product requirements for the unified platform.',
      status: 'Finalized',
      blocks: [],
      comments: [],
      projectId: 'proj-1',
      projectName: 'Unified Workspace Platform',
    },
    {
      id: 'doc-2',
      companyId: 'comp-1',
      title: 'Marketing Strategy 2026',
      category: 'General',
      updatedAt: '3 days ago',
      snippet: 'Outbound campaign goals.',
      status: 'Draft',
      blocks: [],
      comments: [],
      projectId: 'proj-other',
      projectName: 'Marketing Growth',
    },
  ];

  it('renders only documents linked to this project', () => {
    render(
      <ProjectDocsView
        project={mockProject}
        docs={mockDocs}
        onSelectDoc={vi.fn()}
        onCreateProjectDoc={vi.fn()}
        onLinkDoc={vi.fn()}
        onUnlinkDoc={vi.fn()}
      />,
    );

    expect(screen.getByText('UWP PRD & Technical Spec')).toBeInTheDocument();
    expect(screen.queryByText('Marketing Strategy 2026')).not.toBeInTheDocument();
    expect(screen.getByText('1 doc')).toBeInTheDocument();
  });

  it('calls onSelectDoc when clicking a project document card', () => {
    const onSelectDoc = vi.fn();
    render(
      <ProjectDocsView
        project={mockProject}
        docs={mockDocs}
        onSelectDoc={onSelectDoc}
        onCreateProjectDoc={vi.fn()}
        onLinkDoc={vi.fn()}
        onUnlinkDoc={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('UWP PRD & Technical Spec'));
    expect(onSelectDoc).toHaveBeenCalledWith('doc-1');
  });

  it('does not link a document from the empty state without a choice', () => {
    const onLinkDoc = vi.fn();
    render(
      <ProjectDocsView
        project={mockProject}
        docs={[mockDocs[1]]}
        onSelectDoc={vi.fn()}
        onCreateProjectDoc={vi.fn()}
        onLinkDoc={onLinkDoc}
        onUnlinkDoc={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Link Existing Document'));
    expect(onLinkDoc).not.toHaveBeenCalled();
  });

  it('shows a loading state rather than an empty one while docs load', () => {
    render(
      <ProjectDocsView
        project={mockProject}
        docs={[]}
        isLoading
        onSelectDoc={vi.fn()}
        onCreateProjectDoc={vi.fn()}
        onLinkDoc={vi.fn()}
        onUnlinkDoc={vi.fn()}
      />,
    );

    expect(
      screen.queryByText(`No documents linked to ${mockProject.name}`),
    ).not.toBeInTheDocument();
  });

  it('renders empty state when no documents are linked to the project', () => {
    render(
      <ProjectDocsView
        project={mockProject}
        docs={[]}
        onSelectDoc={vi.fn()}
        onCreateProjectDoc={vi.fn()}
        onLinkDoc={vi.fn()}
        onUnlinkDoc={vi.fn()}
      />,
    );

    expect(
      screen.getByText(`No documents linked to ${mockProject.name}`),
    ).toBeInTheDocument();
    expect(screen.getByText('Create PRD')).toBeInTheDocument();
  });
});
