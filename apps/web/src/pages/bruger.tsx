import { isError, unwrap } from "@storyflow/result";
import { GetServerSideProps } from "next";
import Link from "next/link";
import React from "react";
import { api } from "../server/users";
import { User } from "../types";

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const user = await api.users.getUser.query.call({ context: { req, res } });

  if (isError(user)) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: unwrap(user),
    },
  };
};

export default function Page({ user }: { user: User }) {
  return (
    <div className="absolute inset-0 bg-gray-900 text-white flex">
      <div className="w-full h-full bg-gradient-to-br from-fuchsia-600 to-pink-600 flex flex-col gap-24 px-12 py-24">
        <h1 className="text-4xl text-gray-200">Dine projekter</h1>
        <div className="grid grid-cols-2 gap-12">
          <a
            href="/kfs"
            className="rounded-lg bg-white/10 p-10 font-light text-2xl"
          >
            Kristeligt Forbund for Studerende
          </a>
          <a
            href="/kfs"
            className="rounded-lg bg-white/10 p-10 font-light text-2xl"
          >
            Forlaget Semper
          </a>
        </div>
      </div>
      <div className="w-full max-w-lg flex items-center">
        <div className="w-full px-12 flex flex-col gap-24">
          <div className="mx-auto rounded-full w-56 h-56 bg-white" />
          <div className="w-full flex flex-col gap-12">
            <div>
              <div className="text-sm text-gray-200">Navn</div>
              {user.name}
            </div>
            <div>
              <div className="text-sm text-gray-200">Email</div>
              {user.email}
            </div>
          </div>
          <div className="w-full flex flex-col gap-5">
            <Link
              href="/logout"
              className="w-full rounded-full bg-gray-200 hover:bg-white text-gray-900 text-sm text-center py-3 transition-colors"
              prefetch={false}
            >
              Log ud
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
