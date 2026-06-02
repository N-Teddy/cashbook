import { invoke } from "@tauri-apps/api/core";

export type SecurityState = {
  lockEnabled: boolean;
  biometricEnabled: boolean;
  hasPattern: boolean;
};

export async function securityState() {
  return invoke<SecurityState>("security_state");
}

export async function securitySetLockEnabled(enabled: boolean) {
  return invoke<void>("security_set_lock_enabled", { enabled });
}

export async function securitySetBiometricEnabled(enabled: boolean) {
  return invoke<void>("security_set_biometric_enabled", { enabled });
}

export async function securitySetPattern(pattern: string) {
  return invoke<void>("security_set_pattern", { input: { pattern } });
}

export async function securityVerifyPattern(pattern: string) {
  return invoke<boolean>("security_verify_pattern", { input: { pattern } });
}

