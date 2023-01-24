import "../styles.css";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head />
      <body>{children}</body>
    </html>
  );
}
