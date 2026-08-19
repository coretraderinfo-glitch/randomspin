import { BrandMark } from "@/components/ui/BrandMark";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = {
  title: "Admin Login"
};

export default function AdminLoginPage() {
  return (
    <main className="premium-shell grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full">
        <div className="mx-auto mb-8 flex max-w-md justify-center">
          <BrandMark />
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
