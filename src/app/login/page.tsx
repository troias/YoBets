import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold">Login</h1>
      <Input type="email" placeholder="Email" />
      <Input type="password" placeholder="Password" />
      <Button>Email Login</Button>
      <p className="text-sm text-zinc-400">No account? <Link className="underline" href="/register">Register</Link></p>
    </div>
  );
}
