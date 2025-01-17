import type { LinksFunction, LoaderArgs, MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { setUser, withSentry } from "@sentry/remix";

import type { User } from "~/models/user.server";

import NavBar from "~/components/layout/NavBar";
import { authenticator, isEditor } from "~/services/auth.server";
import tailwindStylesheetUrl from "~/styles/tailwind.css";
import { superjson, useSuperLoaderData } from "~/utils/data";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: tailwindStylesheetUrl }];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Flex Spot FF",
  viewport: "width=device-width,initial-scale=1",
});

type LoaderData = {
  user: User | null;
  userIsEditor: boolean;
  ENV: {
    NODE_ENV: string;
    SENTRY_DSN: string;
  };
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request);
  const userIsEditor = !user ? false : isEditor(user);

  if (user) {
    setUser(user);
  }

  return superjson<LoaderData>(
    {
      user,
      userIsEditor,
      ENV: {
        SENTRY_DSN: process.env.SENTRY_DSN,
        NODE_ENV: process.env.NODE_ENV,
      },
    },
    { headers: { "x-superjson": "true" } }
  );
};

function App() {
  const { user, userIsEditor, ENV } = useSuperLoaderData<typeof loader>();

  return (
    <html lang="en" className="dark h-full">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-slate-700 text-white">
        <NavBar user={user} userIsEditor={userIsEditor} />
        <div className="container relative mx-auto min-h-screen p-4 text-white">
          <main className="prose max-w-none dark:prose-invert lg:prose-xl">
            <Outlet />
          </main>
        </div>
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`,
          }}
        />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default withSentry(App);

export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <html>
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-slate-700 text-white">
        <NavBar user={null} userIsEditor={false} />
        <div className="container relative mx-auto min-h-screen p-4 text-white">
          <main className="prose max-w-none dark:prose-invert lg:prose-xl">
            <h1>Error</h1>
            <pre>{error.message}</pre>
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
