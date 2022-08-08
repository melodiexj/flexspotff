import type { LoaderArgs } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";
import {
  authenticator,
  isAdmin,
  isPodcastEditor,
  requireEditor,
} from "~/auth.server";
import type { User } from "~/models/user.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  user: User;
  userIsAdmin: boolean;
  userIsPodcastEditor: boolean;
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  requireEditor(user);

  const [userIsAdmin, userIsPodcastEditor] = await Promise.all([
    isAdmin(user),
    isPodcastEditor(user),
  ]);

  return superjson<LoaderData>(
    { user, userIsAdmin, userIsPodcastEditor },
    { headers: { "x-superjson": "true" } }
  );
};

export default function Admin() {
  const { userIsAdmin, userIsPodcastEditor } =
    useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>Admin</h2>
      <div className="grid md:grid-cols-12 md:gap-4">
        <div className="not-prose text-sm md:col-span-3">
          {userIsAdmin && (
            <section>
              <p
                id="admin-leagues-heading"
                className="mb-3 font-semibold text-slate-900 dark:text-slate-500"
              >
                Leagues
              </p>
              <ul
                aria-labelledby="admin-leagues-heading"
                className="mb-8 space-y-2 p-0"
              >
                <li className="flow-root">
                  <Link
                    to="/admin/registration-list"
                    className="block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300"
                  >
                    Registration List
                  </Link>
                </li>
              </ul>
            </section>
          )}
          {userIsPodcastEditor && (
            <section>
              <p
                id="admin-podcast-heading"
                className="mb-3 font-semibold text-slate-900 dark:text-slate-500"
              >
                Podcast
              </p>
              <ul
                aria-labelledby="admin-podcast-heading"
                className="mb-8 space-y-2 p-0"
              >
                <li className="flow-root">
                  <Link
                    to="/admin/podcasts"
                    className="block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300"
                  >
                    List
                  </Link>
                </li>
                <li className="flow-root">
                  <Link
                    to="/admin/podcasts/new"
                    className="block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300"
                  >
                    Add
                  </Link>
                </li>
              </ul>
            </section>
          )}
        </div>
        <div className="md:col-span-9">
          <Outlet />
        </div>
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div>
      <h2>Error</h2>
      <pre>{error.message}</pre>
    </div>
  );
}