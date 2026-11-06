// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocGallery } from './DocGallery.js';
import type { CompanyItem, DocItem } from './doc-types.js';

describe('DocGallery', () => {
  const mockCompanies: CompanyItem[] = [
    { id: 'comp-1', name: 'Engineering', icon: '💻' },
    { id: 'comp-2', name: 'Product', icon: '🚀' },
  ];

  const mockDocs: DocItem[] = [
    {
      id: 'doc-1',
      companyId: 'comp-1',
      title: 'System Architecture RFC',
      category: 'Architecture',
      updatedAt: '10 minutes ago',
      snippet: 'High-level system overview and component topology.',
      status: 'Finalized',
      favorite: true,
      icon: '🏛️',
      blocks: [],
      comments: [],
      authorName: 'Alex Smith',
      projectId: 'proj-1',
      projectName: 'Core Platform',
    },
    {
      id: 'doc-2',
      companyId: 'comp-2',
      title: 'Q4 Product Roadmap',
      category: 'General',
      updatedAt: '2 days ago',
      snippet: 'Key product themes, milestone deliverables and targets.',
      status: 'Draft',
      favorite: false,
      icon: '📋',
      blocks: [],
      comments: [],
      authorName: 'Sarah Connor',
    },
  ];

  it('renders all document cards and company tags', () => {
    render(
      <DocGallery
        docs={mockDocs}
        companies={mockCompanies}
        onSelectDoc={vi.fn()}
        onNewDoc={vi.fn()}
        onBrowseTemplates={vi.fn()}
      />,
    );

    expect(screen.getByText('System Architecture RFC')).toBeInTheDocument();
    expect(screen.getByText('Q4 Product Roadmap')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Core Platform')).toBeInTheDocument();
  });

  it('filters documents when searching', () => {
    render(
      <DocGallery
        docs={mockDocs}
        companies={mockCompanies}
        onSelectDoc={vi.fn()}
        onNewDoc={vi.fn()}
        onBrowseTemplates={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Search documents…');
    fireEvent.change(searchInput, { target: { value: 'Roadmap' } });

    expect(screen.queryByText('System Architecture RFC')).not.toBeInTheDocument();
    expect(screen.getByText('Q4 Product Roadmap')).toBeInTheDocument();
  });

  it('triggers onSelectDoc when a card is clicked', () => {
    const onSelectDoc = vi.fn();
    render(
      <DocGallery
        docs={mockDocs}
        companies={mockCompanies}
        onSelectDoc={onSelectDoc}
        onNewDoc={vi.fn()}
        onBrowseTemplates={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('System Architecture RFC'));
    expect(onSelectDoc).toHaveBeenCalledWith('doc-1');
  });

  it('shows only the given author, and hides docs with no known author', () => {
    render(
      <DocGallery
        docs={[
          { ...mockDocs[0], authorId: 'me' },
          { ...mockDocs[1], authorId: 'someone-else' },
          { ...mockDocs[1], id: 'doc-3', title: 'No author', authorId: undefined },
        ]}
        companies={mockCompanies}
        filterAuthorId="me"
        onSelectDoc={vi.fn()}
        onNewDoc={vi.fn()}
        onBrowseTemplates={vi.fn()}
      />,
    );

    expect(screen.getByText('System Architecture RFC')).toBeInTheDocument();
    expect(screen.queryByText('Q4 Product Roadmap')).not.toBeInTheDocument();
    expect(screen.queryByText('No author')).not.toBeInTheDocument();
  });

  it('prefers the live project name over the one stored on the doc', () => {
    render(
      <DocGallery
        docs={mockDocs}
        companies={mockCompanies}
        projects={[{ id: 'proj-1', name: 'Renamed Platform' }]}
        onSelectDoc={vi.fn()}
        onNewDoc={vi.fn()}
        onBrowseTemplates={vi.fn()}
      />,
    );

    expect(screen.getByText('Renamed Platform')).toBeInTheDocument();
    expect(screen.queryByText('Core Platform')).not.toBeInTheDocument();
  });

  it('keeps document actions in the compact layout', () => {
    render(
      <DocGallery
        docs={mockDocs}
        companies={mockCompanies}
        onSelectDoc={vi.fn()}
        onNewDoc={vi.fn()}
        onBrowseTemplates={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Compact layout' }));
    expect(
      screen.getAllByRole('button', { name: 'Document actions' }),
    ).toHaveLength(mockDocs.length);
  });

  it('renders empty state when no documents match', () => {
    render(
      <DocGallery
        docs={[]}
        companies={mockCompanies}
        onSelectDoc={vi.fn()}
        onNewDoc={vi.fn()}
        onBrowseTemplates={vi.fn()}
      />,
    );

    expect(screen.getByText('No documents yet')).toBeInTheDocument();
  });
});
