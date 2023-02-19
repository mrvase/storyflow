import React from "react";
import Link from "next/link";
import { client } from "../client";
import { isError } from "@storyflow/result";
import Loader from "../components/Loader";

export default function Page() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState<"login" | "verify">("login");

  const register = async (email: string, name: string) => {
    setLoading(true);
    const result = await client.users.register.mutation({ email, name });
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
        {status === "login" ? (
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              const data = new FormData(ev.currentTarget);
              register(data.get("email") as string, data.get("name") as string);
            }}
            className="w-full px-12 flex flex-col gap-24"
          >
            <h1 className="text-4xl text-gray-200">Opret bruger</h1>
            {error && (
              <div className="bg-red-600 p-5 rounded text-white">
                Mislykkedes
              </div>
            )}
            <div className="w-full flex flex-col gap-12">
              <div>
                <div className="text-sm text-gray-200">Navn</div>
                <input
                  type="text"
                  name="name"
                  ls-ignore="true"
                  className="w-full py-2.5 border-b-2 border-white border-opacity-50 focus:border-opacity-100 bg-transparent outline-none transition-colors"
                  autoComplete="off"
                />
              </div>
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
            </div>
            <div className="w-full flex flex-col gap-5">
              <button
                type="submit"
                className="w-full rounded-full bg-gray-200 h-12 hover:bg-white text-gray-900 text-sm flex-center transition-colors"
              >
                {loading ? <Loader /> : "Opret bruger"}
              </button>
              <div className="w-full text-center text-sm">
                <Link href="login" className="hover:underline">
                  Log ind
                </Link>
              </div>
            </div>
          </form>
        ) : (
          <div className="px-12">
            <h1 className="text-4xl text-gray-200">Email sendt!</h1>
          </div>
        )}
      </div>
      <div className="w-full h-full bg-gradient-to-br from-fuchsia-600 to-pink-600 flex items-center">
        <div className="flex-col px-24">
          <h1 className="text-4xl text-white"></h1>
        </div>
      </div>
    </div>
  );
}
