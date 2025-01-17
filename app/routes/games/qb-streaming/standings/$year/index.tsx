import type { LoaderArgs } from "@remix-run/node";

import {
  getQBSelectionsByWeek,
  getQBSelectionsByYear,
} from "~/models/qbselection.server";
import type { QBStreamingStandingsRow } from "~/models/qbstreamingweek.server";
import { getQBStreamingWeeks } from "~/models/qbstreamingweek.server";

import QBStreamingStandingsRowComponent from "~/components/layout/qb-streaming/QBStreamingStandingsRow";
import { authenticator } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  qbStreamingResults: QBStreamingStandingsRow[];
  currentWeekPicks: Awaited<ReturnType<typeof getQBSelectionsByWeek>>;
  year: string;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const year = params.year ?? `${CURRENT_YEAR}`;

  const qbStreamingWeeks = await getQBStreamingWeeks(CURRENT_YEAR);

  const qbSelections = await getQBSelectionsByYear(CURRENT_YEAR);

  const currentWeekPicks = await getQBSelectionsByWeek(qbStreamingWeeks[0].id);

  const qbStreamingResults: QBStreamingStandingsRow[] = [];
  for (const qbSelection of qbSelections) {
    const existingResult = qbStreamingResults.findIndex(
      (qbStreamingResult) =>
        qbStreamingResult.discordName === qbSelection.user.discordName
    );
    if (existingResult !== -1) {
      qbStreamingResults[existingResult].pointsScored +=
        qbSelection.standardPlayer.pointsScored +
        qbSelection.deepPlayer.pointsScored;
    } else {
      qbStreamingResults.push({
        discordName: qbSelection.user.discordName,
        userId: qbSelection.user.id,
        pointsScored:
          qbSelection.standardPlayer.pointsScored +
          qbSelection.deepPlayer.pointsScored,
      });
    }
  }

  const sortedResults = [...qbStreamingResults].sort((a, b) => {
    if (a.pointsScored !== b.pointsScored) {
      return b.pointsScored - a.pointsScored;
    }

    return a.discordName.localeCompare(b.discordName);
  });

  const rankArray = sortedResults.map((result) => result.pointsScored);

  for (let i = 0; i < sortedResults.length; i++) {
    sortedResults[i].rank =
      rankArray.findIndex(
        (result) => sortedResults[i].pointsScored === result
      ) + 1;
  }

  return superjson<LoaderData>(
    {
      qbStreamingResults: sortedResults,
      currentWeekPicks,
      year,
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function QBStreamingStandingsYearIndex() {
  const { year, qbStreamingResults, currentWeekPicks } =
    useSuperLoaderData<typeof loader>();

  const displayYear = +year !== CURRENT_YEAR ? year : "";

  return (
    <>
      <h2>{displayYear} Overall Standings</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {qbStreamingResults.map((result) => {
            const currentWeekPick = currentWeekPicks.find(
              (pick) => pick.userId === result.userId
            );
            const standardPlayer = !currentWeekPick
              ? "No pick"
              : currentWeekPick.standardPlayer.nflGame.gameStartTime <
                new Date()
              ? currentWeekPick.standardPlayer.player.fullName
              : "Pending";

            const deepPlayer = !currentWeekPick
              ? "No pick"
              : currentWeekPick.deepPlayer.nflGame.gameStartTime < new Date()
              ? currentWeekPick.deepPlayer.player.fullName
              : "Pending";
            return (
              <QBStreamingStandingsRowComponent
                key={result.userId}
                rank={result.rank}
                discordName={result.discordName}
                pointsScored={result.pointsScored}
                standardPlayer={standardPlayer}
                deepPlayer={deepPlayer}
              />
            );
          })}
        </tbody>
      </table>
    </>
  );
}
