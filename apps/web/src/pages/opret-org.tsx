import { isError, unwrap } from "@storyflow/result";
import { GetServerSideProps } from "next";
import Link from "next/link";
import React from "react";
import { client } from "../client";
import { api } from "../server/users";
import { User } from "../types";

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const user = await api.users.getUser.query.call({ context: { req, res } });

  if (isError(user) || unwrap(user).email !== "martin@rvase.dk") {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default function Page({ user }: { user: User }) {
  return (
    <form
      onSubmit={async (ev) => {
        ev.preventDefault();
        let name = new FormData(ev.currentTarget).get("name");
        let email = new FormData(ev.currentTarget).get("email");
        if (typeof name !== "string" || typeof email !== "string") return;
        name = name.toLowerCase();
        email = email.toLowerCase();
        await client.users.createOrganization.mutation({
          slug: name,
          ...(email && { admin: email }),
        });
        if (email) {
          client.users.sendLink.mutation({ email, invite: name });
        }
      }}
      className="flex flex-col rounded-xl bg-gray-900 text-white p-10 font-light max-w-2xl w-full gap-4"
    >
      Organisationsnavn
      <input
        type="text"
        name="name"
        className="bg-transparent border border-white/5 rounded py-1.5 px-3 focus:border-white/20 outline-none"
        autoComplete="off"
      />
      Admin (email)
      <input
        type="text"
        name="email"
        className="bg-transparent border border-white/5 rounded py-1.5 px-3 focus:border-white/20 outline-none"
        autoComplete="off"
      />
      <button type="submit">Opret</button>
    </form>
  );
}