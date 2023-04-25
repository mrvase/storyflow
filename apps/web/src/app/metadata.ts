import { Metadata } from "next";
import { request } from "@storyflow/react/rsc";
import { options } from "./options";
import { getPage } from "./api";

export const metadata: Metadata = {
  title: {
    default: "Storyflow",
    template: "%s | Storyflow",
  },
  icons: {
    icon: [
      {
        url: "/favicon-16x16.png",
        sizes: "16x16",
      },
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
      },
    ],
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
    },
  },
  manifest: "/site.webmanifest",
  themeColor: "#ffffff",
};

export async function generateMetadata({ params }: { params: any }) {
  const url = Object.values(params).join("/");
  const data = await getPage(url); // request(url, options);

  return { title: data?.head?.title };
}
