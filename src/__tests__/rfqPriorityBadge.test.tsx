import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import RfqPriorityBadge, { RfqPriorityPicker } from '@/components/common/RfqPriorityBadge';
import type { RfqPriorityTag } from '@/lib/rfqPriority';

function PickerHost() {
  const [value, setValue] = useState<RfqPriorityTag | null>(null);
  return <RfqPriorityPicker id="priority-test" value={value} onChange={setValue} />;
}

describe('RfqPriorityBadge and picker', () => {
  it('renders nothing when the RFQ is untagged', () => {
    const { container } = render(<RfqPriorityBadge tag={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(render(<RfqPriorityBadge tag="made-up" />).container).toBeEmptyDOMElement();
  });

  it('renders Emergency, Urgent and Hot with their colours', () => {
    const { rerender } = render(<RfqPriorityBadge tag="emergency" />);
    expect(screen.getByText('Emergency')).toHaveClass('bg-red-600');
    rerender(<RfqPriorityBadge tag="urgent" />);
    expect(screen.getByText('Urgent')).toHaveClass('bg-[#FF5A00]');
    rerender(<RfqPriorityBadge tag="hot" />);
    expect(screen.getByText('Hot')).toHaveClass('bg-amber-500');
  });

  it('lets the buyer pick or clear an optional tag', async () => {
    const user = userEvent.setup();
    render(<PickerHost />);
    const emergency = screen.getByRole('button', { name: 'Emergency' });
    const urgent = screen.getByRole('button', { name: 'Urgent' });
    const hot = screen.getByRole('button', { name: 'Hot' });
    expect(emergency).toHaveAttribute('aria-pressed', 'false');
    await user.click(emergency);
    expect(emergency).toHaveAttribute('aria-pressed', 'true');
    await user.click(urgent);
    expect(urgent).toHaveAttribute('aria-pressed', 'true');
    expect(emergency).toHaveAttribute('aria-pressed', 'false');
    await user.click(urgent);
    expect(urgent).toHaveAttribute('aria-pressed', 'false');
    expect(hot).toHaveAttribute('aria-pressed', 'false');
  });
});
