"use client";

import { DomainStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { Button } from "@usesend/ui/src/button";
import { toast } from "@usesend/ui/src/toaster";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";

type Domain = inferRouterOutputs<AppRouter>["domain"]["getDomain"];

export function VerifyDomain({ domain }: { domain: Domain }) {
  const utils = api.useUtils();
  const verification = api.domain.startVerification.useMutation({
    onMutate: async () => {
      await utils.domain.getDomain.cancel({ id: domain.id });
    },
    onSuccess: (result) => {
      utils.domain.getDomain.setData({ id: domain.id }, result);
      void utils.domain.domains.invalidate();
      toast.success("Domain verification checked");
    },
    onError: (error) => {
      toast.error(`Could not check domain verification: ${error.message}`);
    },
  });
  const requiredRecords = domain.dnsRecords.filter(
    (record) => !record.recommended,
  );
  const verified =
    domain.status === DomainStatus.SUCCESS &&
    requiredRecords.every((record) => record.status === DomainStatus.SUCCESS);

  return (
    <div className="flex max-w-sm flex-col items-end gap-2">
      <Button
        variant="outline"
        disabled={verification.isPending}
        aria-busy={verification.isPending}
        onClick={() => verification.mutate({ id: domain.id })}
      >
        {verification.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {verification.isPending ? "Checking DNS records..." : "Verify domain"}
      </Button>
      <div
        role="status"
        aria-live="polite"
        className="text-right text-sm text-muted-foreground"
      >
        {verification.isPending ? (
          "Checking the latest verification status. Please wait."
        ) : verification.error ? (
          <p className="text-destructive">
            Could not check domain verification: {verification.error.message}.
            Please try again.
          </p>
        ) : verification.isSuccess ? (
          <>
            <p>
              {verified
                ? "Check completed. Your domain is verified and ready to send."
                : "Check completed. Some DNS records are not verified yet. Review their status below; DNS changes can take time to propagate."}
            </p>
            {domain.errorMessage ? (
              <p>Verification details: {domain.errorMessage}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
