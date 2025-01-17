import type { LoaderArgs } from "@remix-run/node";

import { getQBSelectionsByWeek } from "~/models/qbselection.server";
import type { QBStreamingStandingsRow } from "~/models/qbstreamingweek.server";
import { getQBStreamingWeeks } from "~/models/qbstreamingweek.server";

import QBStreamingStandingsRowComponent from "~/components/layout/qb-streaming/QBStreamingStandingsRow";
import GoBox from "~/components/ui/GoBox";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  qbSelections: Awaited<ReturnType<typeof getQBSelectionsByWeek>>;
  rankings: QBStreamingStandingsRow[];
  year: string;
  week: number;
  maxWeek: number;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const year = params.year || `${CURRENT_YEAR}`;
  const week = Number(params.week || "1");

  const streamingWeeks = await getQBStreamingWeeks(+year);
  const streamingWeek = streamingWeeks.find(
    (streamingWeek) => streamingWeek.week === week
  );
  if (!streamingWeek) throw new Error("No streaming week found");

  const maxWeek = streamingWeeks[0].week;

  const qbSelections = await getQBSelectionsByWeek(streamingWeek.id);

  const rankings: QBStreamingStandingsRow[] = [];
  for (const qbSelection of qbSelections) {
    rankings.push({
      discordName: qbSelection.user.discordName,
      pointsScored:
        qbSelection.standardPlayer.pointsScored +
        qbSelection.deepPlayer.pointsScored,
      userId: qbSelection.userId,
    });
  }

  rankings.sort((a, b) => b.pointsScored - a.pointsScored);

  const rankingScoreArray = rankings.map((ranking) => ranking.pointsScored);

  for (let i = 0; i < rankings.length; i++) {
    rankings[i].rank =
      rankingScoreArray.findIndex(
        (rankingScore) => rankingScore === rankings[i].pointsScored
      ) + 1;
  }

  return superjson<LoaderData>(
    {
      qbSelections,
      rankings,
      year,
      week,
      maxWeek,
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function QBStreamingStandingsYearWeek() {
  const { qbSelections, rankings, year, week, maxWeek } =
    useSuperLoaderData<typeof loader>();

  const weekArray = Array.from({ length: maxWeek }, (_, i) => i + 1)
    .reverse()
    .map((weekNumber) => ({
      label: `Week ${weekNumber}`,
      url: `/games/qb-streaming/standings/${year}/${weekNumber}`,
    }));

  return (
    <>
      <h2>
        {year} Standings for Week {week}
      </h2>

      <div className="float-right mb-4">
        <GoBox options={weekArray} buttonText="Choose Week" />
      </div>

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((result) => {
            const currentWeekPick = qbSelections.find(
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
