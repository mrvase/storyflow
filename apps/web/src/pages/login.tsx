import { isError } from "@storyflow/result";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";
import { client } from "../client";
import { api } from "../server/users";

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const user = await api.users.getUser.query.call({ context: { req, res } });

  if (!isError(user)) {
    return {
      redirect: {
        destination: "/bruger",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default function Page() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState<"login" | "verify">("login");

  const path = useRouter().asPath;

  const login = async (email: string) => {
    const params = new URL(`http://storyflow.dk${path}`);
    const next = params.searchParams.get("next") ?? undefined;
    setLoading(true);
    const result = await client.users.sendLink.mutation({ email, next });
    setLoading(false);
    if (isError(result)) {
      setError(result.message);
    } else {
      setStatus("verify");
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-900 text-white flex">
      <div className="w-full max-w-lg flex items-center">
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            const data = new FormData(ev.currentTarget);
            login(data.get("email") as string);
          }}
          className="w-full px-12 flex flex-col gap-24"
        >
          <h1 className="text-4xl text-gray-200">Log ind</h1>
          <div>
            <div className="text-sm text-gray-200">Email</div>
            <input
              type="text"
              name="email"
              ls-ignore="true"
              className="w-full py-2.5 border-b-2 border-white border-opacity-50 focus:border-opacity-100 bg-transparent outline-none transition-colors"
              autoComplete="off"
            />
          </div>
          <div className="w-full flex flex-col gap-5">
            <button
              type="submit"
              className="w-full rounded-full bg-gray-200 hover:bg-white text-gray-900 text-sm text-center py-3 transition-colors"
            >
              Log ind
            </button>
            <div className="w-full text-center text-sm">
              <Link href="registrer" className="hover:underline">
                Opret dig
              </Link>
            </div>
          </div>
        </form>
      </div>
      <div className="w-full h-full bg-gradient-to-br from-fuchsia-600 to-pink-600 flex items-center">
        <div className="flex-col px-24">
          <h1 className="text-4xl text-white"></h1>
        </div>
      </div>
    </div>
  );
}
