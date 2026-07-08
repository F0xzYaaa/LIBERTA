import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as mfaApi from '../../api/mfa.api';
import type {
  GenerateMfaResponse,
  VerifyBackupCodeRequest,
  VerifyMfaRequest,
} from '../../api/types/mfa.types';
import type { TokenResponse } from '../../api/types/auth.types';
import { Button, Card, ErrorMessage, Input, LoadingSpinner, useToast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/apiError';

interface MfaLocationState {
  tempToken: string;
  mfaEnrollmentRequired: boolean;
}

function isMfaLocationState(state: unknown): state is MfaLocationState {
  if (typeof state !== 'object' || state === null) return false;
  const candidate = state as Record<string, unknown>;
  return (
    typeof candidate.tempToken === 'string' && typeof candidate.mfaEnrollmentRequired === 'boolean'
  );
}

type VerifyMode = 'totp' | 'backup';

// Step 2 of staff/admin login. Reads the tempToken from router state only --
// there is no persisted copy of it anywhere, so a direct navigation or a
// page refresh (which loses router state) must send the user back to the
// start of the login flow rather than render a broken form.
export function MfaPage(): JSX.Element {
  const location = useLocation();

  if (!isMfaLocationState(location.state)) {
    return <Navigate to="/admin/login" replace />;
  }

  return <MfaFlow state={location.state} />;
}

function MfaFlow({ state }: { state: MfaLocationState }): JSX.Element {
  const { tempToken, mfaEnrollmentRequired } = state;
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<VerifyMode>('totp');
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');

  const enrollQuery = useQuery({
    queryKey: ['mfa-enroll', tempToken],
    queryFn: () => mfaApi.generate(tempToken),
    enabled: mfaEnrollmentRequired,
    retry: false,
  });

  // The backup codes and QR code are only ever shown once (server never
  // returns them again) -- a Toast alone is easy to miss, so this fires
  // alongside the persistent warning banner rendered in EnrollmentDetails.
  useEffect(() => {
    if (enrollQuery.data) {
      showToast('Save your backup codes now — they will not be shown again.', 'info');
    }
  }, [enrollQuery.data, showToast]);

  const verifyMutation = useMutation({
    mutationFn: (): Promise<TokenResponse> => {
      if (mode === 'backup') {
        const payload: VerifyBackupCodeRequest = { tempToken, backupCode: backupCode.trim() };
        return mfaApi.verifyBackupCode(payload);
      }
      const payload: VerifyMfaRequest = { tempToken, totpCode: totpCode.trim() };
      return mfaApi.verify(payload);
    },
    onSuccess: (tokens) => {
      login(tokens);
      navigate('/admin/dashboard', { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    verifyMutation.mutate();
  }

  function toggleMode(): void {
    setMode((current) => (current === 'totp' ? 'backup' : 'totp'));
  }

  const enrollmentReady = !mfaEnrollmentRequired || Boolean(enrollQuery.data);

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-dark px-6 py-12">
      <Card className="w-full max-w-lg">
        <h1 className="font-serif text-2xl font-semibold text-primary-dark">
          {mfaEnrollmentRequired ? 'Set Up Two-Factor Authentication' : 'Two-Factor Verification'}
        </h1>
        <p className="mt-2 font-sans text-sm text-sage-gray">
          {mfaEnrollmentRequired
            ? 'Scan the QR code with your authenticator app, then confirm with a 6-digit code.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>

        {mfaEnrollmentRequired && (
          <div className="mt-6">
            {enrollQuery.isLoading && <LoadingSpinner />}
            {enrollQuery.isError && (
              <ErrorMessage
                message={getErrorMessage(enrollQuery.error, 'Could not start MFA enrollment.')}
              />
            )}
            {enrollQuery.data && <EnrollmentDetails data={enrollQuery.data} />}
          </div>
        )}

        {enrollmentReady && (
          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            {mode === 'totp' ? (
              <Input
                label="6-digit authenticator code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
            ) : (
              <Input
                label="Backup code"
                required
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
              />
            )}

            {verifyMutation.isError && (
              <ErrorMessage
                message={getErrorMessage(
                  verifyMutation.error,
                  'Verification failed. Please try again.',
                )}
              />
            )}

            <Button type="submit" disabled={verifyMutation.isPending}>
              {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
            </Button>

            <button
              type="button"
              className="font-sans text-sm text-primary underline underline-offset-2"
              onClick={toggleMode}
            >
              {mode === 'totp' ? 'Use a backup code instead' : 'Use my authenticator app instead'}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}

function EnrollmentDetails({ data }: { data: GenerateMfaResponse }): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(data.manualEntryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable (e.g. insecure context) -- the key
      // is still visible and selectable in the code block below.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-accent/50 bg-accent/10 px-4 py-3 font-sans text-sm text-primary-dark">
        <strong>Save these backup codes now</strong> — they will not be shown again.
      </div>

      <div className="flex flex-col items-center gap-3">
        <img
          src={data.qrCodeDataUri}
          alt="Scan with your authenticator app"
          className="h-48 w-48 rounded-card border border-sage-gray/20"
        />
        <p className="font-sans text-xs text-sage-gray">
          Can&apos;t scan? Enter this key manually:
        </p>
        <div className="flex items-center gap-2">
          <code className="rounded-card bg-cream px-3 py-1.5 font-mono text-sm text-primary-dark">
            {data.manualEntryKey}
          </code>
          <Button variant="ghost" onClick={() => void handleCopy()}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      <div>
        <p className="font-sans text-sm font-medium text-primary-dark">Backup codes</p>
        <ul className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm text-primary-dark">
          {data.backupCodes.map((code) => (
            <li key={code} className="rounded-card bg-cream px-3 py-1.5 text-center">
              {code}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
