import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileText, Heart, Plus } from 'lucide-react';
import {
  AccountCard,
  ActionsCard,
  BarsChart,
  Gauge,
  Kpi,
  Mini,
  Notice,
  PageHeader,
  Panel,
  QuickLink,
  Segmented,
  Skeleton,
} from '@/components/dashboard/parts';

const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

function inRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/** Pretends the browser is (or is not) set to reduce motion. jsdom has no matchMedia of its own. */
function setReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
}

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error put back the browser without matchMedia that the other tests expect
  delete window.matchMedia;
});

describe('Dashboard parts: KPI card', () => {
  it('shows the title, the value and a link when it leads somewhere', () => {
    inRouter(<Kpi title="Requirements Posted" value={12} icon={FileText} tone="orange" to="/dashboard/buyer/requirements" />);
    const card = screen.getByRole('link');
    expect(card).toHaveAttribute('href', '/dashboard/buyer/requirements');
    expect(within(card).getByText('Requirements Posted')).toBeInTheDocument();
    expect(within(card).getByText('12')).toBeInTheDocument();
  });

  it('is a plain card without a destination', () => {
    inRouter(<Kpi title="Total Orders" value={7} icon={FileText} tone="blue" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('is a button for a card that switches something on the same page', () => {
    const open = vi.fn();
    inRouter(<Kpi title="Open Disputes" value={2} icon={FileText} tone="rose" onClick={open} hint="Open the list" />);
    fireEvent.click(screen.getByRole('button', { name: /Open Disputes/ }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Open the list')).toBeInTheDocument();
  });

  it('shows a rise in green and a fall in red, with what it was compared with', () => {
    const { rerender } = inRouter(<Kpi title="Quotes" value={90} icon={FileText} tone="purple" delta={{ pct: 12.5, label: 'vs last month' }} />);
    const rise = screen.getByText('▲ 12.5%');
    expect(rise).toHaveClass('is-up');
    expect(screen.getByText('vs last month')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <Kpi title="Quotes" value={90} icon={FileText} tone="purple" delta={{ pct: -4, label: 'vs last month' }} />
      </MemoryRouter>,
    );
    const fall = screen.getByText('▼ 4%');
    expect(fall).toHaveClass('is-down');
  });

  it('says "no change", without an arrow or a colour, when the figure is the same as before', () => {
    inRouter(<Kpi title="Quotes" value={9} icon={FileText} tone="purple" delta={{ pct: 0, label: 'vs last month' }} />);
    const same = screen.getByText('● No change');
    expect(same).toHaveClass('is-flat');
    expect(same).not.toHaveClass('is-up');
    expect(same).not.toHaveClass('is-down');
    expect(same.textContent).not.toMatch(/[▲▼]/);
  });

  it('shows no change figure when there is nothing to compare with', () => {
    inRouter(<Kpi title="Quotes" value={3} icon={FileText} tone="purple" delta={{ pct: null, label: 'vs last month' }} />);
    expect(screen.queryByText(/vs last month/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('can show a unit after the value, and a line of small print', () => {
    inRouter(<Kpi title="RFQ Leads Left" value={32} suffix="/ 50" icon={FileText} tone="blue" hint="Of your plan" />);
    expect(screen.getByText('/ 50')).toBeInTheDocument();
    expect(screen.getByText('Of your plan')).toBeInTheDocument();
  });

  it('shows a shimmer instead of the figure while it loads', () => {
    const { container } = inRouter(<Kpi title="Quotes" value={90} icon={FileText} tone="purple" loading />);
    expect(screen.queryByText('90')).not.toBeInTheDocument();
    expect(container.querySelector('.dskel')).not.toBeNull();
    expect(container.querySelector('.dk')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});

describe('Dashboard parts: figures that count up', () => {
  it('climbs from zero to the figure when motion is welcome, and keeps the text it was given', () => {
    setReducedMotion(false);
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
    inRouter(<Kpi title="Revenue" value="₹48,000" icon={FileText} tone="yellow" />);
    expect(screen.getByText('₹0')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(450);
    });
    const midway = screen.getByText(/^₹[\d,]+$/).textContent as string;
    const amount = Number(midway.replace(/[^\d]/g, ''));
    expect(amount).toBeGreaterThan(0);
    expect(amount).toBeLessThan(48000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('₹48,000')).toBeInTheDocument();
  });

  it('counts plain numbers and figures with a suffix', () => {
    setReducedMotion(false);
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
    inRouter(
      <>
        <Kpi title="Orders" value={90} icon={FileText} tone="blue" />
        <Kpi title="Reply time" value="3h" icon={FileText} tone="rose" />
      </>,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0h')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('3h')).toBeInTheDocument();
  });

  it('shows the figure at once when the browser asks for reduced motion', () => {
    setReducedMotion(true);
    inRouter(<Kpi title="Orders" value={90} icon={FileText} tone="blue" />);
    expect(screen.getByText('90')).toBeInTheDocument();
  });

  it('leaves text that is not a figure alone', () => {
    setReducedMotion(false);
    inRouter(<Kpi title="Reply time" value="—" icon={FileText} tone="rose" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('Dashboard parts: small stat, panel, quick link and the rest', () => {
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

  it('shows no change on a small stat when there is none, and can be the dark one', () => {
    const { container } = render(<Mini dark label="Orders this month" value={0} pct={null} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(container.querySelector('.dmini')).toHaveClass('is-dark');
  });

  it('shows a panel with its title, subtitle, right-hand part and an arrow link', () => {
    inRouter(
      <Panel title="Activity" subtitle="By month" to="/somewhere" right={<span>Last year</span>}>
        <p>inside</p>
      </Panel>,
    );
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByText('By month')).toBeInTheDocument();
    expect(screen.getByText('Last year')).toBeInTheDocument();
    expect(screen.getByText('inside')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Activity' })).toHaveAttribute('href', '/somewhere');
  });

  it('shows a quick link with its count, even when the count is zero, and without one when there is none', () => {
    const { rerender } = inRouter(<QuickLink to="/x" icon={FileText} label="Notifications" count={3} />);
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveTextContent('3');
    rerender(
      <MemoryRouter>
        <QuickLink to="/x" icon={FileText} label="Notifications" count={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveTextContent('0');
    rerender(
      <MemoryRouter>
        <QuickLink to="/x" icon={FileText} label="Profile settings" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Profile settings' })).not.toHaveTextContent(/\d/);
  });

  it('shows a page header with a title, a subtitle and buttons', () => {
    inRouter(<PageHeader title="Hi, Suresh!" subtitle="Welcome back" actions={<button type="button">Post</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hi, Suresh!' })).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post' })).toBeInTheDocument();
  });

  it('lets a subtitle hold a badge without nesting a block inside a paragraph', () => {
    const { container } = inRouter(<PageHeader title="Hi" subtitle={<div>badge</div>} />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('shows a notice with a title, a tag, text and a button', () => {
    inRouter(
      <Notice icon={FileText} tone="warn" title="Unpaid account" tag="Contacts Locked" action={<button type="button">Pay</button>}>
        Subscribe to unlock contacts.
      </Notice>,
    );
    expect(screen.getByText('Unpaid account')).toBeInTheDocument();
    expect(screen.getByText('Contacts Locked')).toBeInTheDocument();
    expect(screen.getByText('Subscribe to unlock contacts.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument();
    expect(document.querySelector('.dnotice')).toHaveClass('is-warn');
  });

  it('draws a shimmer block that screen readers skip', () => {
    const { container } = render(<Skeleton style={{ width: 40 }} />);
    expect(container.querySelector('.dskel')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lists the places to go next, with a hint under each', () => {
    inRouter(
      <ActionsCard
        title="Jump back in"
        subtitle="Where to go"
        items={[
          { to: '/post-requirement', icon: Plus, label: 'Post a requirement', hint: 'Tell manufacturers what you need' },
          { to: '/dashboard/buyer/quotes', icon: FileText, label: 'Compare quotes' },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Jump back in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Post a requirement/ })).toHaveAttribute('href', '/post-requirement');
    expect(screen.getByText('Tell manufacturers what you need')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Compare quotes/ })).toHaveAttribute('href', '/dashboard/buyer/quotes');
  });
});

describe('Dashboard parts: segmented control', () => {
  const options = [
    { value: 'posted', label: 'Requirements' },
    { value: 'quotes', label: 'Quotes' },
  ];

  it('marks the chosen option and reports a click on another one', () => {
    const change = vi.fn();
    render(<Segmented label="Chart shows" value="posted" onChange={change} options={options} />);
    expect(screen.getByRole('tablist', { name: 'Chart shows' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Requirements' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Quotes' })).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(screen.getByRole('tab', { name: 'Quotes' }));
    expect(change).toHaveBeenCalledWith('quotes');
  });

  it('moves between the options with the arrow keys, wrapping round, and moves focus with it', () => {
    const change = vi.fn();
    render(<Segmented label="Chart shows" value="posted" onChange={change} options={options} />);
    const first = screen.getByRole('tab', { name: 'Requirements' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith('quotes');
    expect(screen.getByRole('tab', { name: 'Quotes' })).toHaveFocus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(change).toHaveBeenLastCalledWith('quotes');
    fireEvent.keyDown(first, { key: 'a' });
    expect(change).toHaveBeenCalledTimes(2);
  });

  it('puts only the chosen option in the tab order', () => {
    render(<Segmented label="Chart shows" value="quotes" onChange={() => undefined} options={options} />);
    expect(screen.getByRole('tab', { name: 'Quotes' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Requirements' })).toHaveAttribute('tabindex', '-1');
  });
});

describe('Dashboard parts: account card', () => {
  const rows = [
    { icon: Heart, label: 'Saved manufacturers', value: 3 },
    { icon: FileText, label: 'Verification', value: 'Verified' },
  ];

  it('shows who the person is and a line for each fact', () => {
    inRouter(<AccountCard initials="SK" name="Suresh Kumar" role="Buyer" rows={rows} to="/dashboard/buyer/profile" />);
    expect(screen.getByText('SK')).toBeInTheDocument();
    expect(screen.getByText('Suresh Kumar')).toBeInTheDocument();
    expect(screen.getByText('Buyer')).toBeInTheDocument();
    expect(screen.getByText('Saved manufacturers')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Account' })).toHaveAttribute('href', '/dashboard/buyer/profile');
  });

  it('shows how much of the profile is filled in, kept between 0 and 100', () => {
    const { rerender } = inRouter(<AccountCard initials="SK" name="S" role="Buyer" rows={rows} progress={{ label: 'Profile completion', value: 70 }} />);
    expect(screen.getByRole('progressbar', { name: 'Profile completion' })).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByText('70%')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <AccountCard initials="SK" name="S" role="Buyer" rows={rows} progress={{ label: 'Profile completion', value: 140 }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('progressbar', { name: 'Profile completion' })).toHaveAttribute('aria-valuenow', '100');
  });

  it('has no bar when there is no progress to show', () => {
    inRouter(<AccountCard initials="SK" name="S" role="Buyer" rows={rows} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('Dashboard parts: bar chart', () => {
  const bars = [4, 6, 3, 8, 5, 9, 2, 7, 4, 6, 1, 12];

  const chart = (values = bars) => render(<BarsChart months={MONTHS} bars={values} barLabel="requirements" emptyText="Nothing in the last 12 months yet." ariaLabel="Requirements in each of the last 12 months" />);

  it('says so instead of drawing empty bars when every value is zero', () => {
    const { container } = chart(Array(12).fill(0));
    expect(screen.getByText('Nothing in the last 12 months yet.')).toBeInTheDocument();
    expect(container.querySelector('.dbar')).toBeNull();
  });

  it('describes itself and gives every month its own labelled button', () => {
    chart();
    const group = screen.getByRole('group', { name: 'Requirements in each of the last 12 months' });
    expect(within(group).getAllByRole('button')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Mar: 8 requirements' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nov: 12 requirements' })).toBeInTheDocument();
  });

  it('lights the tallest bar and shows its figure until another one is pointed at', () => {
    const { container } = chart();
    const lit = () => Array.from(container.querySelectorAll('.dbar.is-lit'));
    expect(lit()).toHaveLength(1);
    expect(lit()[0]).toHaveAttribute('aria-label', 'Nov: 12 requirements');
    expect(container.querySelector('.dbar-tag')).toHaveTextContent('12');
    const june = screen.getByRole('button', { name: 'May: 9 requirements' });
    fireEvent.mouseEnter(june);
    expect(lit()).toHaveLength(1);
    expect(lit()[0]).toBe(june);
    expect(container.querySelector('.dbar-tag')).toHaveTextContent('9');
    fireEvent.mouseLeave(june);
    expect(lit()[0]).toHaveAttribute('aria-label', 'Nov: 12 requirements');
  });

  it('moves the highlight with keyboard focus as well', () => {
    const { container } = chart();
    const jan = screen.getByRole('button', { name: 'Jan: 6 requirements' });
    fireEvent.focus(jan);
    expect(container.querySelector('.dbar.is-lit')).toBe(jan);
    fireEvent.blur(jan);
    expect(container.querySelector('.dbar.is-lit')).toHaveAttribute('aria-label', 'Nov: 12 requirements');
  });

  it('labels the months and a round scale', () => {
    const { container } = chart();
    expect(Array.from(container.querySelectorAll('.dbars-x span')).map((span) => span.textContent)).toEqual(MONTHS);
    expect(Array.from(container.querySelectorAll('.dbars-y span')).map((span) => span.textContent)).toEqual(['20', '15', '10', '5', '0']);
  });

  it('draws a line at the average, tagged with it, at an end where no bar reaches above it', () => {
    const { container } = chart();
    const avg = container.querySelector('.dbars-avg') as HTMLElement;
    expect(avg).toHaveTextContent('Avg 5.6');
    // the last bar (12) is above the average, the first (4) is below it, so the tag goes to the left
    expect(avg).toHaveClass('is-left');
    const low = chart([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1]);
    expect(low.container.querySelector('.dbars-avg')).toHaveClass('is-right');
  });

  it('can leave the average out', () => {
    const { container } = render(<BarsChart months={MONTHS} bars={bars} barLabel="requirements" emptyText="none" ariaLabel="Chart" showAverage={false} />);
    expect(container.querySelector('.dbars-avg')).toBeNull();
  });

  it('marks a month with nothing in it, and still gives it a bar to point at', () => {
    const { container } = chart([...bars.slice(0, 11), 0]);
    expect(container.querySelectorAll('.dbar')).toHaveLength(12);
    expect(container.querySelectorAll('.dbar.is-zero')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Nov: 0 requirements' })).toHaveClass('is-zero');
  });

  it('gives each bar a height in proportion to its value', () => {
    const { container } = chart();
    const heights = Array.from(container.querySelectorAll<HTMLElement>('.dbar-pill')).map((pill) => parseFloat(pill.style.height));
    // 12 on a scale to 20 is 60%; 6 is 30%
    expect(heights[11]).toBeCloseTo(60, 0);
    expect(heights[1]).toBeCloseTo(30, 0);
  });
});

describe('Dashboard parts: gauge', () => {
  const filled = (root: HTMLElement) => root.querySelectorAll('.dseg-on').length;

  it('shows the percentage and its label', () => {
    render(<Gauge value={58.3} label="Requirements with quotes" />);
    expect(screen.getByText('58.3%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Requirements with quotes: 58.3%' })).toBeInTheDocument();
  });

  it('lights as many of the 36 fan segments as the percentage is worth', () => {
    const { container, rerender } = render(<Gauge value={0} label="x" />);
    expect(container.querySelectorAll('path')).toHaveLength(36);
    expect(filled(container)).toBe(0);
    rerender(<Gauge value={100} label="x" />);
    expect(filled(container)).toBe(36);
    rerender(<Gauge value={50} label="x" />);
    expect(filled(container)).toBe(18);
    rerender(<Gauge value={87} label="x" />);
    expect(filled(container)).toBe(31);
  });

  it('lights at least one segment for a small value above zero, so the gauge is not read as empty', () => {
    const { container } = render(<Gauge value={1} label="x" />);
    expect(filled(container)).toBe(1);
  });

  it('keeps a value out of range inside the gauge', () => {
    const { container } = render(<Gauge value={140} label="x" />);
    expect(filled(container)).toBe(36);
  });

  it('draws a ring of 60 ticks when asked to', () => {
    const { container } = render(<Gauge variant="ring" value={50} label="Verified companies" />);
    expect(container.querySelector('.dgauge')).toHaveClass('is-ring');
    expect(container.querySelectorAll('line')).toHaveLength(60);
    expect(filled(container)).toBe(30);
  });

  it('shows a dash and says there is nothing to measure yet, without lighting any segment', () => {
    const { container } = render(<Gauge value={null} label="Requirements with quotes" emptyText="Post a requirement to start" />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Post a requirement to start')).toBeInTheDocument();
    expect(filled(container)).toBe(0);
    expect(screen.getByRole('img', { name: 'Requirements with quotes: no data yet' })).toBeInTheDocument();
  });

  it('can carry a line of small print under it', () => {
    render(<Gauge value={58} label="x" footer="7 of 12 requirements have a quote" />);
    expect(screen.getByText('7 of 12 requirements have a quote')).toBeInTheDocument();
  });
});
