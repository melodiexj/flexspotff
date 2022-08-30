import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form, useTransition } from "@remix-run/react";
import { useState } from "react";

import type { Bet } from "~/models/poolgame.server";
import { getPoolGamesByYearAndWeek } from "~/models/poolgame.server";
import type { PoolGamePickCreate } from "~/models/poolgamepicks.server";
import { createPoolGamePicks } from "~/models/poolgamepicks.server";
import {
  deletePoolGamePicksForUserAndWeek,
  getPoolGamePicksByUserAndPoolWeek,
} from "~/models/poolgamepicks.server";
import type { PoolWeek } from "~/models/poolweek.server";
import { getPoolWeekByYearAndWeek } from "~/models/poolweek.server";
import type { User } from "~/models/user.server";

import SpreadPoolGameComponent from "~/components/layout/spread-pool/SpreadPoolGame";
import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import {
  superjson,
  useSuperActionData,
  useSuperLoaderData,
} from "~/utils/data";

type ActionData = {
  message?: string;
};

type LoaderData = {
  user?: User;
  poolWeek?: PoolWeek;
  poolGames?: Awaited<ReturnType<typeof getPoolGamesByYearAndWeek>>;
  notOpenYet?: string;
};

export const action = async ({ params, request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const year = params.year;
  const week = params.week;

  if (!year) throw new Error(`No year set`);
  if (!week) throw new Error(`No week set`);

  const poolWeek = await getPoolWeekByYearAndWeek(+year, +week);
  if (!poolWeek) throw new Error(`Missing pool week.`);
  const poolGames = await getPoolGamesByYearAndWeek(+year, +week);
  console.log(poolGames);

  // Create map of all teams in week and set bet to 0
  const nflTeamIdToAmountBetMap: Map<string, number> = new Map();
  for (const poolGame of poolGames) {
    nflTeamIdToAmountBetMap.set(
      `${poolGame.id}-${poolGame.game.homeTeamId}`,
      0
    );
    nflTeamIdToAmountBetMap.set(
      `${poolGame.id}-${poolGame.game.awayTeamId}`,
      0
    );
  }

  // Update map with existing bets
  const existingBets = await getPoolGamePicksByUserAndPoolWeek(user, poolWeek);
  for (const existingBet of existingBets) {
    nflTeamIdToAmountBetMap.set(
      `${existingBet.poolGameId}-${existingBet.teamBetId}`,
      0
    );
  }

  // Update map with new bets that are eligible
  const newBetsForm = await request.formData();
  for (const [key, amount] of newBetsForm.entries()) {
    const [poolGameId, teamId] = key.split("-");
    if (!teamId || teamId === "undefined") continue;

    const poolGame = poolGames.find((poolGame) => poolGame.id === poolGameId);
    if (!poolGame) continue;

    if (poolGame.game.gameStartTime > new Date()) {
      nflTeamIdToAmountBetMap.set(key, Math.abs(+amount));
    }
  }

  // Loop through map and build promises to send down for creates
  const dataToInsert: PoolGamePickCreate[] = [];
  for (const [key, amountBet] of nflTeamIdToAmountBetMap.entries()) {
    console.log({ key, amountBet });
    const [poolGameId, teamBetId] = key.split("-");
    dataToInsert.push({
      userId: user.id,
      amountBet,
      poolGameId,
      teamBetId,
    });
  }

  // Delete existing bets and wholesale replace them with the insert
  // I think this is actually quicker than upserting and there's no harm in recreating this data
  await deletePoolGamePicksForUserAndWeek(user, poolWeek);
  await createPoolGamePicks(dataToInsert);

  return superjson<ActionData>(
    { message: "Your picks have been saved." },
    { headers: { "x-superjson": "true" } }
  );
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  // TODO: Remove when going live
  requireAdmin(user);

  const year = params.year;
  const week = params.week;

  if (!year) throw new Error(`No year set`);
  if (!week) throw new Error(`No week set`);

  const poolWeek = await getPoolWeekByYearAndWeek(+year, +week);

  if (!poolWeek) {
    return superjson<LoaderData>({
      notOpenYet: "Week has not been created yet.",
    });
  }
  if (!poolWeek.isOpen) {
    return superjson<LoaderData>({
      notOpenYet: "Lines have not been set for this week yet.",
    });
  }

  const poolGames = await getPoolGamesByYearAndWeek(+year, +week);

  return superjson<LoaderData>(
    { user, poolWeek, poolGames },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesSpreadPoolWeek() {
  const actionData = useSuperActionData<ActionData>();
  const { notOpenYet, poolGames } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  const initialBudget = 1000;
  const [bets, setBets] = useState<Bet[]>([]);

  const handleChange = (bets: Bet[]) => {
    setBets((prevBets) => {
      const newBetTeamIds = bets.map((bet) => bet.teamId);
      const cleanedBets = prevBets.filter(
        (prevBet) => !newBetTeamIds.includes(prevBet.teamId)
      );
      return [...cleanedBets, ...bets];
    });
  };

  const betAmount = bets.reduce((a, b) => a + b.amount, 0);
  const availableToBet = initialBudget - betAmount;

  const disableSubmit = transition.state !== "idle" || availableToBet < 0;

  return (
    <>
      <h2>Week Entry</h2>
      <Form method="post">
        {notOpenYet || (
          <>
            {actionData?.message && <Alert message={actionData.message} />}
            <div className="mb-4">
              <div>Available to bet: {availableToBet}</div>
              <div>Amount currently bet: {betAmount}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-12">
              {poolGames?.map((poolGame) => (
                <SpreadPoolGameComponent
                  key={poolGame.id}
                  handleChange={handleChange}
                  poolGame={poolGame}
                />
              ))}
            </div>
            <div className="m-4">
              {availableToBet < 0 && (
                <p className="text-red-500">
                  You cannot bet more than your available budget, which is
                  currently {availableToBet}.
                </p>
              )}
              <Button type="submit" disabled={disableSubmit}>
                Update Picks
              </Button>
            </div>
          </>
        )}
      </Form>
    </>
  );
}