import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
  /*
  const params = searchParams();

  const email = params.get("email");
  const name = params.get("name");
  */

  return <>{children}</>;
}
