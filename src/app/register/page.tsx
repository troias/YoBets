import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold">Register</h1>
      <Input type="text" placeholder="Display name" />
      <Input type="email" placeholder="Email" />
      <Input type="password" placeholder="Password" />
      <Button>Create Account</Button>
    </div>
  );
}
