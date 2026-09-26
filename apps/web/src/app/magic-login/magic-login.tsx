"use client";

import Spinner from "@usesend/ui/src/spinner";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function MagicLogin() {
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = searchParams.get("token");
    const requestedRedirect = searchParams.get("redirectTo");
    const redirectTo =
      requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
        ? requestedRedirect
        : "/dashboard";

    if (!token) {
      setError("This sign-in link is invalid.");
      return;
    }

    void signIn("credentials", {
      token,
      callbackUrl: redirectTo,
      redirect: false,
    })
      .then((result) => {
        if (!result?.ok || result.error) {
          setError("This sign-in link is invalid, expired, or already used.");
          return;
        }

        window.location.replace(result.url ?? redirectTo);
      })
      .catch(() => {
        setError("Unable to sign in. Please request a new link from Noyra.");
      });
  }, [searchParams]);

  if (error) {
    return (
      <p className="max-w-[350px] text-center text-sm text-destructive">
        {error}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <Spinner className="h-5 w-5" />
      Signing you in...
    </div>
  );
}
