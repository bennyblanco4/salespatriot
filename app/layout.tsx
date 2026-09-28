import "./globals.css";
export const metadata = {
  title: "PatriotBid | Solicitation browser",
  description: "Find DLA opportunities worth quoting.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
