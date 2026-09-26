import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import MagicLogin from "./magic-login";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MagicLoginPage() {
  return (
    <main className="h-screen flex flex-col gap-6 justify-center items-center">
      <Image src="/logo-squircle.png" alt="useSend" width={50} height={50} />
      <Suspense fallback={null}>
        <MagicLogin />
      </Suspense>
    </main>
  );
}
