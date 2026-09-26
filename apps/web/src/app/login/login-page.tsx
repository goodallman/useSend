import Image from "next/image";

export default function LoginPage() {
  return (
    <main className="h-screen flex justify-center items-center">
      <div className="flex flex-col gap-6">
        <Image
          src="/logo-squircle.png"
          alt="useSend"
          width={50}
          height={50}
          className="mx-auto"
        />
        <div>
          <p className="text-2xl text-center font-semibold">
            Sign into useSend
          </p>
          <p className="mt-2 max-w-[350px] text-center text-sm text-muted-foreground">
            Open the secure sign-in link provided by Noyra. This app does not
            support direct registration or password login.
          </p>
        </div>
      </div>
    </main>
  );
}
