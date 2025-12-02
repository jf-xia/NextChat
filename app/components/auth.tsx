"use client";

import styles from "./auth.module.scss";
import { useState, useEffect, ChangeEvent } from "react";
import Image from "next/image";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { getClientConfig } from "../config/client";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest, msalConfig } from "../auth/authConfig";

export function AuthPage() {
  const navigate = useNavigate();
  const { instance, inProgress } = useMsal();

  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const isMsalBusy =
    inProgress === InteractionStatus.Startup ||
    inProgress === InteractionStatus.HandleRedirect;
  const shouldDisableSignIn = !hasAgreed || isLoggingIn || isMsalBusy;

  const toList = (raw: string | undefined, fallback: string[]) => {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (err) {
      const split = raw
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      if (split.length > 0) {
        return split;
      }
    }
    return fallback;
  };

  const serviceLimitations = toList(
    process.env.NEXT_PUBLIC_SERVICE_LIMITATIONS,
    [
      // Default service limitations
    ],
  );

  const usageTerms = toList(process.env.NEXT_PUBLIC_USAGE_TERMS, [
    // Default service limitations
  ]);
  const logoUrl = process.env.NEXT_PUBLIC_APP_LOGO_URL ?? "";

  const handleAgreementChange = (event: ChangeEvent<HTMLInputElement>) => {
    setHasAgreed(event.target.checked);
  };

  const handleLogin = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const response = await instance.loginPopup(loginRequest);
      if (response?.account) {
        instance.setActiveAccount(response.account);
      }
      navigate(Path.Home);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to login with Microsoft.";
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    if (getClientConfig()?.isApp) {
      navigate(Path.Settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles["auth-page"]}>
      <main className={styles["auth-main"]}>
        <section className={styles["terms-card"]}>
          <Image
            src={logoUrl}
            alt="App Logo"
            width={180}
            height={60}
            className={styles["app-logo"]}
          />
          <div className={styles["terms-content"]}>
            <h1>Terms and conditions for using AI service</h1>

            <div className={styles["terms-section"]}>
              {loginError && (
                <div className={styles["auth-error"]}>{loginError}</div>
              )}

              <p>
                Please be aware that this is a demo service which may be subject
                to certain instabilities:
              </p>

              <ul>
                {serviceLimitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <p>
                To use the service, staff and students must agree to the
                following terms and conditions:
              </p>

              <ol>
                {usageTerms.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ol>
            </div>

            <div className={styles["checkbox-row"]}>
              <input
                id="agree"
                type="checkbox"
                checked={hasAgreed}
                onChange={handleAgreementChange}
              />
              <label htmlFor="agree">
                I have read, understood, and agreed to the above terms and
                conditions.
              </label>
            </div>
            {!hasAgreed && (
              <div className={styles["agreement-warning"]}>
                Please agree to the terms before signing in.
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles["sign-in"]}
            onClick={handleLogin}
            disabled={shouldDisableSignIn}
          >
            Sign in
          </button>
        </section>
      </main>
    </div>
  );
}
