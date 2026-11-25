import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aisensyOtpBody, clientIp, generateCode, normalizePhone, passwordProblem, phoneHint } from '../../supabase/functions/password-reset/logic';

const invoke = vi.fn();
vi.mock('@/db/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import WhatsAppPasswordReset from '@/components/auth/WhatsAppPasswordReset';

describe('password reset helpers', () => {
  it('codes are 6 digits, including leading zeros', () => {
    expect(generateCode((n) => { n[0] = 42; return n; })).toBe('000042');
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  it('rejects random values that would bias the code', () => {
    const vals = [0xffffffff, 7];
    expect(generateCode((n) => { n[0] = vals.shift() as number; return n; })).toBe('000007');
  });
  it('phones, hints, passwords and IPs', () => {
    expect(normalizePhone('98765 43210')).toBe('919876543210');
    expect(normalizePhone('12345')).toBeNull();
    expect(phoneHint('919876543210')).toBe('•••• 10');
    expect(passwordProblem('short1')).toBeTruthy();
    expect(passwordProblem('onlyletters')).toBeTruthy();
    expect(passwordProblem('letters123')).toBeNull();
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
  });
  it('sends the code as the only template parameter (and to the copy-code button when asked)', () => {
    const b = aisensyOtpBody('k', 'otp', '919876543210', 'Test', '123456', false);
    expect(b).toMatchObject({ campaignName: 'otp', destination: '919876543210', templateParams: ['123456'] });
    expect('buttons' in b).toBe(false);
    expect(aisensyOtpBody('k', 'otp', '9', 'T', '123456', true).buttons?.[0].parameters[0].text).toBe('123456');
  });
});

describe('forgot password dialog', () => {
  beforeEach(() => invoke.mockReset());

  it('e-mail → WhatsApp code → new password saved, with no e-mail link', async () => {
    const onDone = vi.fn();
    invoke.mockResolvedValueOnce({ data: { status: 'sent', phone_hint: '•••• 10' }, error: null });
    render(<WhatsAppPasswordReset initialEmail="owner@test.invalid" onBusy={() => {}} onClose={() => {}} onDone={onDone} />);
    expect(screen.queryByText(/reset link/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /send code on whatsapp/i }));
    await screen.findByText('•••• 10');
    expect(invoke).toHaveBeenCalledWith('password-reset', { body: { action: 'request', email: 'owner@test.invalid' } });

    fireEvent.change(screen.getByLabelText(/code from whatsapp/i), { target: { value: '12 34 56' } });
    fireEvent.change(document.getElementById('reset-pw') as HTMLInputElement, { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/new password again/i), { target: { value: 'newpass124' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    expect(await screen.findByText(/do not match/i)).toBeTruthy();
    expect(invoke).toHaveBeenCalledTimes(1);

    invoke.mockResolvedValueOnce({ data: { status: 'ok' }, error: null });
    fireEvent.change(screen.getByLabelText(/new password again/i), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }));
    await screen.findByText(/password changed/i);
    expect(invoke).toHaveBeenLastCalledWith('password-reset', { body: { action: 'reset', email: 'owner@test.invalid', code: '123456', password: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /log in now/i }));
    expect(onDone).toHaveBeenCalledWith('owner@test.invalid');
  });

  it('explains when the account has no WhatsApp number or the service is not set up', async () => {
    invoke.mockResolvedValueOnce({ data: { status: 'no_phone' }, error: null });
    render(<WhatsAppPasswordReset initialEmail="x@test.invalid" onBusy={() => {}} onClose={() => {}} onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /send code on whatsapp/i }));
    expect(await screen.findByText(/no whatsapp number/i)).toBeTruthy();
    invoke.mockResolvedValueOnce({ data: null, error: { context: new Response('', { status: 404 }) } });
    fireEvent.click(screen.getByRole('button', { name: /send code on whatsapp/i }));
    await waitFor(() => expect(screen.getByText(/not set up yet/i)).toBeTruthy());
  });
});
