import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { securityState, securityVerifyPattern } from "../../lib/security";
import { PatternLock } from "./PatternLock";

async function tryBiometric(): Promise<boolean> {
  try {
    const mod = await import("@tauri-apps/plugin-biometric");
    await mod.authenticate("Unlock Expense Tracker");
    return true;
  } catch {
    return false;
  }
}

export function LockGate(props: { onUnlocked: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasPattern, setHasPattern] = useState(false);
  // false = biometric not yet attempted; true = it failed/unavailable, show fallback
  const [biometricFailed, setBiometricFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await securityState();
        if (cancelled) return;

        if (!s.lockEnabled) {
          props.onUnlocked();
          return;
        }

        // Use the local values directly — don't rely on React state being updated yet.
        setNeedsUnlock(true);
        setBiometricEnabled(s.biometricEnabled);
        setHasPattern(s.hasPattern);
        setLoading(false);

        // Try biometric immediately using the freshly-read state values.
        if (s.biometricEnabled) {
          const ok = await tryBiometric();
          if (cancelled) return;
          if (ok) {
            props.onUnlocked();
          } else {
            setBiometricFailed(true);
          }
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        // Fail open to avoid bricking dev builds.
        props.onUnlocked();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="grid h-full place-items-center px-4">
        <div className="text-sm text-zinc-600">Locking…</div>
      </div>
    );
  }

  if (!needsUnlock) return null;

  // Biometric is enabled but hasn't resolved yet — show a waiting state.
  const waitingForBiometric = biometricEnabled && !biometricFailed;

  return (
    <div className="grid h-full place-items-center px-4">
      <div className="w-full max-w-sm space-y-3">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-zinc-900 text-white">
              <Fingerprint className="size-5" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">
                App locked
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {biometricEnabled
                  ? waitingForBiometric
                    ? "Use your fingerprint to unlock."
                    : "Fingerprint failed. Use your pattern as fallback."
                  : "Draw your pattern to unlock."}
              </div>
            </div>
          </div>
          {error ? (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          ) : null}
          {/* Retry biometric button after failure */}
          {biometricEnabled && biometricFailed ? (
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 py-2 text-sm font-medium"
              onClick={async () => {
                setError(null);
                setBiometricFailed(false);
                const ok = await tryBiometric();
                if (ok) props.onUnlocked();
                else setBiometricFailed(true);
              }}
            >
              <Fingerprint className="size-4" />
              Try fingerprint again
            </button>
          ) : null}
        </div>

        {/* Show pattern fallback only when biometric is not pending */}
        {!waitingForBiometric && hasPattern ? (
          <PatternLock
            title="Draw your pattern"
            subtitle={
              biometricEnabled
                ? "Or use fingerprint above."
                : undefined
            }
            onComplete={async (pattern) => {
              setError(null);
              try {
                const ok = await securityVerifyPattern(pattern);
                if (ok) props.onUnlocked();
                else setError("Wrong pattern.");
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          />
        ) : null}

        {/* Only show this message if no biometric AND no pattern */}
        {!biometricEnabled && !hasPattern ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
            No unlock method configured. Go to Settings → Security to set a
            pattern or enable fingerprint.
          </div>
        ) : null}
      </div>
    </div>
  );
}

