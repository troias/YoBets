export const dynamic = "force-dynamic";
import RegisterForm from "./register-form";
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const params = await searchParams;
  return <RegisterForm refCode={params.ref ?? ""} />;
}
