import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import * as authApi from '../../api/auth.api';
import type { LoginRequest } from '../../api/types/auth.types';
import { Button, Card, ErrorMessage, Input } from '../../components/ui';
import { getErrorMessage } from '../../lib/apiError';
import logo from '../../assets/LIBERTAR_Logo.png';

// Step 1 of staff/admin login. MFA is mandatory for every employee account,
// so a successful POST /auth/login never returns a JWT pair directly -- only
// a short-lived tempToken that MfaPage exchanges for real tokens. The
// tempToken is passed via router state only (never persisted to storage).
export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginRequest>({ username: '', password: '' });

  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (data) => {
      navigate('/admin/mfa', {
        state: {
          tempToken: data.tempToken,
          mfaEnrollmentRequired: data.mfaEnrollmentRequired,
        },
      });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    loginMutation.mutate({ username: form.username.trim(), password: form.password });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-dark px-6">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="LIBERTA หัวหิน" className="h-14 w-14 rounded-full object-cover" />
          <h1 className="font-serif text-2xl font-semibold text-primary-dark">Staff Login</h1>
          <p className="text-center font-sans text-sm text-sage-gray">
            Sign in with your employee account to access the LIBERTA admin console.
          </p>
        </div>

        <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Username"
            required
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
          <Input
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          {loginMutation.isError && (
            <ErrorMessage
              message={getErrorMessage(
                loginMutation.error,
                'Could not sign in. Please check your username and password.',
              )}
            />
          )}
          <Button type="submit" disabled={loginMutation.isPending} className="mt-2">
            {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
