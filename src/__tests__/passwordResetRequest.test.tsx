import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/db/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/components/layouts/DashboardLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

import PasswordResetRequest from '@/components/auth/PasswordResetRequest';
import AdminPasswordResetsPage from '@/pages/dashboard/admin/AdminPasswordResetsPage';
import { normalizeMobile, passwordProblem } from '@/lib/passwordResetRequest';

beforeEach(() => {
  rpc.mockReset();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.message.mockClear();
});

describe('password reset request: the rules (same as the database)', () => {
  it('reads Indian mobile numbers with +91, a leading 0, spaces or dashes', () => {
    expect(normalizeMobile('+91 98765 43210')).toBe('9876543210');
    expect(normalizeMobile('098765-43210')).toBe('9876543210');
    expect(normalizeMobile('9876543210')).toBe('9876543210');
    expect(normalizeMobile('12345')).toBeNull();
    expect(normalizeMobile('5876543210')).toBeNull();
  });
  it('asks for 8–72 characters with letters and a number', () => {
    expect(passwordProblem('short1')).toBeTruthy();
    expect(passwordProblem('onlyletters')).toBeTruthy();
    expect(passwordProblem(`${'a'.repeat(72)}1`)).toBeTruthy();
    expect(passwordProblem('letters123')).toBeNull();
  });
});

const fill = (email: string, phone: string, pw: string, pw2 = pw) => {
  fireEvent.change(screen.getByLabelText(/e-mail address/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/mobile number on your account/i), { target: { value: phone } });
  fireEvent.change(document.getElementById('forgot-pw') as HTMLInputElement, { target: { value: pw } });
  fireEvent.change(document.getElementById('forgot-pw2') as HTMLInputElement, { target: { value: pw2 } });
};
const save = () => fireEvent.click(screen.getByRole('button', { name: /save new password/i }));

describe('forgot password on the login page: no link, no OTP', () => {
  it('saves the new password as a request and says the team will call', async () => {
    rpc.mockResolvedValueOnce({ data: { status: 'received' }, error: null });
    render(<PasswordResetRequest initialEmail="Owner@Mills.invalid" onBusy={() => {}} onClose={() => {}} />);
    expect(screen.getByLabelText(/e-mail address/i)).toHaveValue('Owner@Mills.invalid');
    expect(screen.queryByText(/reset link/i)).toBeNull();
    fill(' Owner@Mills.invalid ', '+91 98765 43210', 'NewPass123');
    save();
    await screen.findByText('Request received');
    expect(rpc).toHaveBeenCalledWith('pwreset_request', { p_email: 'owner@mills.invalid', p_phone: '+91 98765 43210', p_password: 'NewPass123' });
    expect(screen.getByText(/will call the mobile number registered on it/i)).toBeInTheDocument();
    expect(screen.getByText(/no link or code will be sent/i)).toBeInTheDocument();
  });

  it('checks the fields before sending anything', () => {
    render(<PasswordResetRequest initialEmail="" onBusy={() => {}} onClose={() => {}} />);
    save();
    expect(screen.getByText('Please enter your e-mail address.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your mobile number.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    fill('owner@mills.invalid', '12345', 'NewPass123', 'NewPass124');
    save();
    expect(screen.getByText('Enter your 10-digit mobile number.')).toBeInTheDocument();
    fill('owner@mills.invalid', '9876543210', 'NewPass123', 'NewPass124');
    save();
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('says so when there have been too many requests, or the request could not be sent', async () => {
    rpc.mockResolvedValueOnce({ data: { status: 'too_many' }, error: null });
    render(<PasswordResetRequest initialEmail="owner@mills.invalid" onBusy={() => {}} onClose={() => {}} />);
    fill('owner@mills.invalid', '9876543210', 'NewPass123');
    save();
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'network' } });
    save();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not be sent/i));
  });

  it('can show the passwords it is typed into', () => {
    render(<PasswordResetRequest initialEmail="" onBusy={() => {}} onClose={() => {}} />);
    expect(document.getElementById('forgot-pw')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: /show passwords/i }));
    expect(document.getElementById('forgot-pw')).toHaveAttribute('type', 'text');
  });
});

const row = {
  id: 'r1', status: 'pending', email: 'owner@mills.invalid', created_at: '2026-11-25T03:00:00Z', expires_at: '2026-11-27T03:00:00Z',
  decided_at: null, note: null, ip: '198.51.100.3', phone_given: '9000099999', phone_registered: '+91 98765 43210', phone_match: false,
  full_name: 'Mill Owner', role: 'supplier', company_name: 'Test Mills Pvt Ltd', account_created_at: null, requests_same_ip_24h: 1, decided_by_name: null,
};

describe('admin: Password Resets', () => {
  it('lists a request with the number to call, warns when the typed number differs, and approves only after the call is ticked', async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'admin_pwreset_requests') return { data: { rows: [row], pending: 1 }, error: null };
      if (name === 'admin_pwreset_decide') return { data: { status: 'approved' }, error: null };
      return { data: null, error: null };
    });
    render(<MemoryRouter><AdminPasswordResetsPage /></MemoryRouter>);
    const card = await screen.findByRole('article', { name: /owner@mills.invalid/ });
    expect(within(card).getByText('Mill Owner')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /98765 43210/ })).toHaveAttribute('href', 'tel:+919876543210');
    expect(within(card).getByText(/not the one on the account/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Waiting (1)' })).toHaveAttribute('aria-selected', 'true');

    const approve = within(card).getByRole('button', { name: /approve new password/i });
    expect(approve).toBeDisabled();
    fireEvent.click(within(card).getByRole('checkbox'));
    fireEvent.change(within(card).getByLabelText('Note about the call'), { target: { value: 'Spoke to the owner' } });
    fireEvent.click(approve);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_pwreset_decide', { p_id: 'r1', p_approve: true, p_note: 'Spoke to the owner' }));
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('rejects without the tick, and shows decided requests on the other tab', async () => {
    rpc.mockImplementation(async (name: string, args: { p_view?: string }) => {
      if (name === 'admin_pwreset_requests') {
        return args.p_view === 'done'
          ? { data: { rows: [{ ...row, id: 'r2', status: 'rejected', decided_at: '2026-11-25T04:00:00Z', decided_by_name: 'Admin One', note: 'No answer' }], pending: 0 }, error: null }
          : { data: { rows: [row], pending: 1 }, error: null };
      }
      return { data: { status: 'rejected' }, error: null };
    });
    render(<MemoryRouter><AdminPasswordResetsPage /></MemoryRouter>);
    const card = await screen.findByRole('article', { name: /owner@mills.invalid/ });
    fireEvent.click(within(card).getByRole('button', { name: /reject/i }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_pwreset_decide', { p_id: 'r1', p_approve: false, p_note: null }));
    fireEvent.click(screen.getByRole('tab', { name: 'Decided' }));
    expect(await screen.findByText(/by Admin One/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve new password/i })).toBeNull();
  });

  it('explains when only a super admin may approve', async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'admin_pwreset_requests') return { data: { rows: [{ ...row, role: 'admin' }], pending: 1 }, error: null };
      return { data: null, error: { message: 'super_admin_only' } };
    });
    render(<MemoryRouter><AdminPasswordResetsPage /></MemoryRouter>);
    const card = await screen.findByRole('article', { name: /owner@mills.invalid/ });
    fireEvent.click(within(card).getByRole('checkbox'));
    fireEvent.click(within(card).getByRole('button', { name: /approve new password/i }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Only a super admin can reset the password of an admin account.'));
  });
});
