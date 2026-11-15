import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FileText } from 'lucide-react';
import { BarsChart, Gauge, Kpi, Mini, Panel, QuickLink } from '@/components/dashboard/parts';

const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

function inRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Dashboard parts: KPI card', () => {
  it('shows the title, the value and a link when it leads somewhere', () => {
    inRouter(<Kpi title="Requirements Posted" value={12} icon={FileText} tone="orange" to="/dashboard/buyer/requirements" />);
    const card = screen.getByRole('link');
    expect(card).toHaveAttribute('href', '/dashboard/buyer/requirements');
    expect(within(card).getByText('Requirements Posted')).toBeInTheDocument();
    expect(within(card).getByText('12')).toBeInTheDocument();
    expect(within(card).getByText(/View more/)).toBeInTheDocument();
  });

  it('is not a link without a destination', () => {
    inRouter(<Kpi title="Total Orders" value={7} icon={FileText} tone="blue" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/View more/)).not.toBeInTheDocument();
  });

  it('shows a rise in green and a fall in red, with what it was compared with', () => {
    const { rerender } = inRouter(<Kpi title="Quotes" value={90} icon={FileText} tone="purple" delta={{ pct: 12.5, label: 'vs last month' }} />);
    const rise = screen.getByText(/12.5%/).closest('p') as HTMLElement;
    expect(rise).toHaveClass('is-up');
    expect(rise).toHaveTextContent('▲ 12.5% vs last month');
    rerender(
      <MemoryRouter>
        <Kpi title="Quotes" value={90} icon={FileText} tone="purple" delta={{ pct: -4, label: 'vs last month' }} />
      </MemoryRouter>,
    );
    const fall = screen.getByText(/4%/).closest('p') as HTMLElement;
    expect(fall).toHaveClass('is-down');
    expect(fall).toHaveTextContent('▼ 4% vs last month');
  });

  it('says "no change", without an arrow or a colour, when the figure is the same as before', () => {
    inRouter(<Kpi title="Quotes" value={9} icon={FileText} tone="purple" delta={{ pct: 0, label: 'vs last month' }} />);
    const same = screen.getByText(/No change/).closest('p') as HTMLElement;
    expect(same).toHaveClass('is-flat');
    expect(same).not.toHaveClass('is-up');
    expect(same).not.toHaveClass('is-down');
    expect(same).toHaveTextContent('● No change vs last month');
    expect(same.textContent).not.toMatch(/[▲▼]/);
  });

  it('shows no arrow when there is nothing to compare with', () => {
    inRouter(<Kpi title="Quotes" value={3} icon={FileText} tone="purple" delta={{ pct: null, label: 'vs last month' }} />);
    expect(screen.queryByText(/vs last month/)).not.toBeInTheDocument();
  });

  it('can show a unit after the value', () => {
    inRouter(<Kpi title="RFQ Leads Left" value={32} suffix="/ 50" icon={FileText} tone="blue" />);
    expect(screen.getByText('/ 50')).toBeInTheDocument();
  });
});

describe('Dashboard parts: small stat, panel and quick link', () => {
  it('shows a small stat with its change', () => {
    render(<Mini label="Quotes this month" value={9} pct={50} />);
    expect(screen.getByText('Quotes this month')).toBeInTheDocument();
    expect(screen.getByText('▲ 50%')).toHaveClass('is-up');
  });

  it('shows a small stat that stayed the same without an arrow', () => {
    render(<Mini label="Quotes this month" value={4} pct={0} />);
    const same = screen.getByText('● No change');
    expect(same).toHaveClass('is-flat');
    expect(same.textContent).not.toMatch(/[▲▼]/);
  });

  it('shows no change on a small stat when there is none', () => {
    render(<Mini label="Orders this month" value={0} pct={null} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('shows a panel with its title, legend and an arrow link', () => {
    inRouter(
      <Panel title="Activity" subtitle="By month" to="/somewhere" legend={[{ label: 'Posted', color: '#f2802d' }]}>
        <p>inside</p>
      </Panel>,
    );
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByText('By month')).toBeInTheDocument();
    expect(screen.getByText('Posted')).toBeInTheDocument();
    expect(screen.getByText('inside')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Activity' })).toHaveAttribute('href', '/somewhere');
  });

  it('shows a quick link with a count only when there is something to count', () => {
    const { rerender } = inRouter(<QuickLink to="/x" icon={FileText} label="Notifications" count={3} />);
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveTextContent('3');
    rerender(
      <MemoryRouter>
        <QuickLink to="/x" icon={FileText} label="Notifications" count={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Notifications/ })).not.toHaveTextContent('0');
  });
});

describe('Dashboard parts: bar chart', () => {
  const bars = [4, 6, 3, 8, 5, 9, 2, 7, 4, 6, 1, 12];
  const line = [2, 3, 1, 4, 2, 5, 1, 3, 2, 3, 0, 6];

  it('says so instead of drawing empty bars when every value is zero', () => {
    render(<BarsChart months={MONTHS} bars={Array(12).fill(0)} barLabel="requirements" line={Array(12).fill(0)} lineLabel="quotes" emptyText="Nothing in the last 12 months yet." ariaLabel="Chart" />);
    expect(screen.getByText('Nothing in the last 12 months yet.')).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeNull();
  });

  it('draws a bar for each month that has a value, and no bar for a month with none', () => {
    const { container } = render(<BarsChart months={MONTHS} bars={bars} barLabel="requirements" emptyText="none" ariaLabel="Chart" />);
    expect(container.querySelectorAll('.dbar')).toHaveLength(12);
    const withGap = render(<BarsChart months={MONTHS} bars={[...bars.slice(0, 11), 0]} barLabel="requirements" emptyText="none" ariaLabel="Chart" />);
    expect(withGap.container.querySelectorAll('.dbar')).toHaveLength(11);
  });

  it('draws the line only when it is given one', () => {
    const without = render(<BarsChart months={MONTHS} bars={bars} barLabel="requirements" emptyText="none" ariaLabel="Chart" />);
    expect(without.container.querySelector('.dline')).toBeNull();
    const withLine = render(<BarsChart months={MONTHS} bars={bars} barLabel="requirements" line={line} lineLabel="quotes" emptyText="none" ariaLabel="Chart" />);
    expect(withLine.container.querySelector('.dline')).not.toBeNull();
  });

  it('describes itself to a screen reader and lists every month\'s figures in a table', () => {
    render(<BarsChart months={MONTHS} bars={bars} barLabel="requirements" line={line} lineLabel="quotes" emptyText="none" ariaLabel="Requirements and quotes in each of the last 12 months" />);
    expect(screen.getByRole('img', { name: 'Requirements and quotes in each of the last 12 months' })).toBeInTheDocument();
    const table = screen.getByRole('table', { hidden: true });
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(13);
    expect(within(table).getByText('Nov')).toBeInTheDocument();
  });

  it('shows the month\'s figures when a month is pointed at or focused', () => {
    const { container } = render(<BarsChart months={MONTHS} bars={bars} barLabel="requirements" line={line} lineLabel="quotes" emptyText="none" ariaLabel="Chart" />);
    expect(container.querySelector('.dtip')).toBeNull();
    const hits = container.querySelectorAll('.dhit');
    expect(hits).toHaveLength(12);
    fireEvent.mouseEnter(hits[11]);
    const tip = container.querySelector('.dtip') as HTMLElement;
    expect(tip).toHaveTextContent('Nov');
    expect(tip).toHaveTextContent('12 requirements');
    expect(tip).toHaveTextContent('6 quotes');
    fireEvent.mouseLeave(hits[11]);
    expect(container.querySelector('.dtip')).toBeNull();
    fireEvent.focus(hits[0]);
    expect(container.querySelector('.dtip')).toHaveTextContent('Dec');
  });

  it('labels each month for keyboard and screen-reader users too', () => {
    const { container } = render(<BarsChart months={MONTHS} bars={bars} barLabel="requirements" line={line} lineLabel="quotes" emptyText="none" ariaLabel="Chart" />);
    expect(container.querySelectorAll('.dhit')[3]).toHaveAttribute('aria-label', 'Mar: 8 requirements, 4 quotes');
  });
});

describe('Dashboard parts: gauge', () => {
  const filledTicks = (root: HTMLElement) => Array.from(root.querySelectorAll('.dtick')).filter((tick) => tick.getAttribute('fill') !== '#26272e').length;

  it('shows the percentage and its label', () => {
    render(<Gauge value={58.3} label="Requirements with quotes" />);
    expect(screen.getByText('58.3%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Requirements with quotes: 58.3%' })).toBeInTheDocument();
  });

  it('lights as many of the fifteen segments as the percentage is worth', () => {
    const { container, rerender } = render(<Gauge value={0} label="x" />);
    expect(container.querySelectorAll('.dtick')).toHaveLength(15);
    expect(filledTicks(container)).toBe(0);
    rerender(<Gauge value={100} label="x" />);
    expect(filledTicks(container)).toBe(15);
    rerender(<Gauge value={50} label="x" />);
    expect(filledTicks(container)).toBe(8);
    rerender(<Gauge value={87} label="x" />);
    expect(filledTicks(container)).toBe(13);
  });

  it('keeps a value out of range inside the gauge', () => {
    const { container } = render(<Gauge value={140} label="x" />);
    expect(filledTicks(container)).toBe(15);
  });

  it('shows a dash and says there is nothing to measure yet, without lighting any segment', () => {
    const { container } = render(<Gauge value={null} label="Requirements with quotes" emptyText="Post a requirement to start" />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Post a requirement to start')).toBeInTheDocument();
    expect(filledTicks(container)).toBe(0);
    expect(screen.getByRole('img', { name: 'Requirements with quotes: no data yet' })).toBeInTheDocument();
  });
});
