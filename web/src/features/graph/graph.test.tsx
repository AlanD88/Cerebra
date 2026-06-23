import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import { renderWithProviders, stubFetchByPath } from '../../test/utils';
import { ConceptNode, type ConceptNodeData } from './ConceptNode';
import { ConceptInspector } from './ConceptInspector';
import { GraphPage } from './GraphPage';

function nodeData(overrides: Partial<ConceptNodeData> = {}): ConceptNodeData {
  return {
    label: 'Eigenvector',
    heatState: 'warm',
    importance: 4,
    mastery: 0.68,
    dimmed: false,
    selected: false,
    ...overrides,
  };
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('ConceptNode', () => {
  it('labels the node by name and heat for screen readers, full opacity at rest', () => {
    renderWithProviders(
      <ReactFlowProvider>
        <ConceptNode data={nodeData()} />
      </ReactFlowProvider>,
    );
    const el = screen.getByLabelText('Eigenvector, Warm');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ opacity: '1' });
  });

  it('dims when outside the active set (label + opacity, never color alone)', () => {
    renderWithProviders(
      <ReactFlowProvider>
        <ConceptNode data={nodeData({ dimmed: true })} />
      </ReactFlowProvider>,
    );
    expect(screen.getByLabelText('Eigenvector, Warm')).toHaveStyle({ opacity: '0.26' });
  });
});

describe('ConceptInspector', () => {
  const detail = {
    conceptId: 'c1',
    name: 'Eigenvector',
    subject: 'Linear Algebra',
    breadcrumb: 'Linear Algebra',
    importance: 4,
    mastery: 0.68,
    retention: 0.61,
    recallAccuracy: 0.74,
    problemAccuracy: 0.5,
    heatState: 'warm',
    reviewCount: 5,
    dueAt: null,
    intuition: 'A direction only scaled by the map.',
    definition: 'A\\mathbf{v}=\\lambda\\mathbf{v}',
    notes: '',
    vizSpec: null,
  };

  const deps = [
    { conceptId: 'm1', name: 'Matrix', heatState: 'cold', mastery: 0.2, isRootWeakness: true },
  ];

  function stub() {
    // '/dependencies' must precede 'concepts/c1' — the deps URL contains both.
    return stubFetchByPath({
      '/dependencies': deps,
      'concepts/c1': detail,
    });
  }

  function renderInspector(props: Partial<Parameters<typeof ConceptInspector>[0]> = {}) {
    return renderWithProviders(
      <Routes>
        <Route
          path="/graph"
          element={
            <ConceptInspector
              conceptId="c1"
              subjectName="Linear Algebra"
              onClose={props.onClose ?? (() => {})}
              onShowPath={props.onShowPath ?? (() => {})}
            />
          }
        />
        <Route path="/concepts/:conceptId" element={<div>CONCEPT PAGE</div>} />
      </Routes>,
      { route: '/graph' },
    );
  }

  it('shows the concept, its mastery/retention and prerequisites from the shared cache', async () => {
    vi.stubGlobal('fetch', stub());
    renderInspector();

    expect(await screen.findByRole('heading', { name: 'Eigenvector' })).toBeInTheDocument();
    expect(screen.getByText('Mastery')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument(); // mastery %
    expect(screen.getByText('Retention')).toBeInTheDocument();
    expect(screen.getByText('61')).toBeInTheDocument(); // retention %
    expect(await screen.findByText('Matrix')).toBeInTheDocument(); // prerequisite
  });

  it('navigates to the full concept page on "Open page"', async () => {
    vi.stubGlobal('fetch', stub());
    renderInspector();
    fireEvent.click(await screen.findByRole('button', { name: 'Open page' }));
    expect(await screen.findByText('CONCEPT PAGE')).toBeInTheDocument();
  });

  it('asks the canvas to draw the learning path on "Show learning path"', async () => {
    const onShowPath = vi.fn();
    vi.stubGlobal('fetch', stub());
    renderInspector({ onShowPath });
    fireEvent.click(await screen.findByRole('button', { name: 'Show learning path' }));
    expect(onShowPath).toHaveBeenCalledOnce();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    vi.stubGlobal('fetch', stub());
    renderInspector({ onClose });
    await screen.findByRole('heading', { name: 'Eigenvector' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('GraphPage', () => {
  const graphStub = (subjects: { id: string; name: string }[]) =>
    stubFetchByPath({
      '/subjects': subjects,
      '/layout': [],
      '/nodes': [
        { conceptId: 'a', name: 'Vectors', importance: 5, heatState: 'mastered', mastery: 0.9 },
        { conceptId: 'b', name: 'Matrix', importance: 4, heatState: 'cold', mastery: 0.2 },
      ],
      '/edges': [{ source: 'a', target: 'b', type: 'prerequisite', strength: 1 }],
    });

  it('renders the atlas header, a subject switcher and the canvas controls', async () => {
    vi.stubGlobal(
      'fetch',
      graphStub([
        { id: 's1', name: 'Linear Algebra' },
        { id: 's2', name: 'Calculus' },
      ]),
    );
    renderWithProviders(<GraphPage />, { route: '/graph' });

    expect(await screen.findByRole('heading', { name: 'Knowledge Graph' })).toBeInTheDocument();
    // subject switcher (two subjects → two chips)
    expect(await screen.findByRole('button', { name: 'Linear Algebra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calculus' })).toBeInTheDocument();
    // canvas overlays render even though jsdom can't lay out the RF viewport
    expect(await screen.findByLabelText('Search concepts')).toBeInTheDocument();
    expect(screen.getByText('Heat')).toBeInTheDocument();
  });

  it('hides the switcher when there is a single subject', async () => {
    vi.stubGlobal('fetch', graphStub([{ id: 's1', name: 'Linear Algebra' }]));
    renderWithProviders(<GraphPage />, { route: '/graph' });

    expect(await screen.findByLabelText('Search concepts')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Linear Algebra' })).not.toBeInTheDocument();
  });

  it('teaches an empty state when there are no subjects yet', async () => {
    vi.stubGlobal('fetch', graphStub([]));
    renderWithProviders(<GraphPage />, { route: '/graph' });
    expect(await screen.findByText(/your atlas is empty/i)).toBeInTheDocument();
  });
});
