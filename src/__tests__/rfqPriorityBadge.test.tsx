import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import RfqPriorityBadge, { RfqPriorityPicker } from '@/components/common/RfqPriorityBadge';
import type { RfqPriorityChoice } from '@/lib/rfqPriority';
import { PRIORITY_TAG_REQUIRED_MESSAGE } from '@/lib/rfqPriority';

function PickerHost({ required = false, error }: { required?: boolean; error?: string }) {
  const [value, setValue] = useState<RfqPriorityChoice | null>(null);
  return <RfqPriorityPicker id="priority-test" value={value} onChange={setValue} required={required} error={error} />;
}

describe('RfqPriorityBadge and picker', () => {
  it('renders nothing when the RFQ is untagged', () => {
    const { container } = render(<RfqPriorityBadge tag={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(render(<RfqPriorityBadge tag="made-up" />).container).toBeEmptyDOMElement();
  });

  it('renders Emergency, Urgent and Hot with their colours', () => {
    const { rerender } = render(<RfqPriorityBadge tag="emergency" />);
    expect(screen.getByText('Emergency').parentElement).toHaveClass('bg-red-600');
    rerender(<RfqPriorityBadge tag="urgent" />);
    expect(screen.getByText('Urgent Requirement').parentElement).toHaveClass('bg-[#FF5A00]');
    rerender(<RfqPriorityBadge tag="hot" />);
    expect(screen.getByText('Hot').parentElement).toHaveClass('bg-amber-500');
  });

  it('lets the buyer pick Urgent Requirement, Emergency, Hot or Regular', async () => {
    const user = userEvent.setup();
    render(<PickerHost required />);
    const emergency = screen.getByRole('button', { name: 'Emergency' });
    const urgent = screen.getByRole('button', { name: 'Urgent Requirement' });
    const hot = screen.getByRole('button', { name: 'Hot' });
    const regular = screen.getByRole('button', { name: 'Regular' });
    expect(emergency).toHaveAttribute('aria-pressed', 'false');
    await user.click(emergency);
    expect(emergency).toHaveAttribute('aria-pressed', 'true');
    await user.click(urgent);
    expect(urgent).toHaveAttribute('aria-pressed', 'true');
    expect(emergency).toHaveAttribute('aria-pressed', 'false');
    await user.click(regular);
    expect(regular).toHaveAttribute('aria-pressed', 'true');
    expect(urgent).toHaveAttribute('aria-pressed', 'false');
    expect(hot).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a validation error when a required tag has not been chosen', () => {
    render(<PickerHost required error={PRIORITY_TAG_REQUIRED_MESSAGE} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a priority tag');
    expect(screen.getByText('Priority tag')).toBeInTheDocument();
  });
});
