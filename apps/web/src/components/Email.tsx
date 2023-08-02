import { withComponent } from "@storyflow/react";
import {
  Body,
  Container,
  Html,
  Tailwind,
  Button,
  Link,
} from "@react-email/components";

export const EmailConfig = withComponent(
  ({ file }) => {
    const link = `https://app.storyflow.dk/api/bucket/file/${file}`;
    return (
      <Tailwind>
        <Html>
          <Body>
            <Container className="mx-auto max-w-xl">
              <p>En fil er blevet uploadet via kfs.dk.</p>
              <p>Klik på knappen herunder for at se den:</p>
              <Button
                href={link}
                className="px-6 py-3 rounded-full bg-blue-600 text-white"
              >
                Gå til fil
              </Button>
              <p className="text-sm text-gray-600">
                Link:{" "}
                <Link href={link} className="text-gray-600 underline">
                  {link}
                </Link>
              </p>
            </Container>
          </Body>
        </Html>
      </Tailwind>
    );
  },
  {
    label: "Email",
    props: {
      file: {
        type: "file",
        label: "Fil",
      },
    },
  }
);
