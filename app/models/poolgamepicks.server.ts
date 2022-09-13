import type { PoolGamePick } from "~/models/poolgamepicks.server";
import type { PoolWeek } from "~/models/poolweek.server";
import type { User } from "~/models/user.server";

import { prisma } from "~/db.server";

import type { PoolGameByYearAndWeekElement } from "./poolgame.server";

export type { PoolGamePick } from "@prisma/client";

export type PoolGamePickCreate = Omit<
  PoolGamePick,
  "id" | "createdAt" | "updatedAt" | "resultWonLoss"
>;

type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
export type PoolGamePicksWonLoss = ArrElement<
  Awaited<ReturnType<typeof getPoolGamePicksWonLoss>>
>;

export async function createPoolGamePick(poolGamePick: PoolGamePickCreate) {
  return prisma.poolGamePick.create({
    data: poolGamePick,
  });
}

export async function createPoolGamePicks(poolGamePicks: PoolGamePickCreate[]) {
  return prisma.poolGamePick.createMany({
    data: poolGamePicks,
    skipDuplicates: true,
  });
}

export async function deletePoolGamePicksForUserAndWeek(
  user: User,
  poolWeek: PoolWeek
) {
  return prisma.poolGamePick.deleteMany({
    where: {
      userId: user.id,
      poolGame: {
        poolWeekId: poolWeek.id,
      },
    },
  });
}

export async function getPoolGamesPicksByPoolWeek(poolWeek: PoolWeek) {
  return prisma.poolGamePick.findMany({
    where: {
      poolGame: {
        poolWeekId: poolWeek.id,
      },
    },
    include: {
      poolGame: {
        include: {
          game: true,
        },
      },
      teamBet: true,
    },
  });
}

export async function getPoolGamePicksByUserAndPoolWeek(
  user: User,
  poolWeek: PoolWeek
) {
  return prisma.poolGamePick.findMany({
    where: {
      userId: user.id,
      poolGame: {
        poolWeekId: poolWeek.id,
      },
    },
  });
}

export async function getPoolGamePicksByUserAndYear(
  user: User,
  year: PoolWeek["year"]
) {
  return prisma.poolGamePick.findMany({
    where: {
      userId: user.id,
      poolGame: {
        poolWeek: {
          year,
        },
      },
    },
  });
}

export async function getPoolGamePicksWonLoss() {
  return prisma.poolGamePick.groupBy({
    by: ["userId"],
    _sum: {
      resultWonLoss: true,
    },
    orderBy: {
      _sum: {
        resultWonLoss: "desc",
      },
    },
  });
}

export async function updatePoolGamePicksWithResults(
  poolGame: PoolGameByYearAndWeekElement
) {
  if (
    poolGame.game.homeTeamScore + poolGame.homeSpread >
    poolGame.game.awayTeamScore
  ) {
    return prisma.$transaction([
      prisma.$executeRaw`UPDATE "PoolGamePick" SET "resultWonLoss" = "amountBet", "isScored" = true WHERE "poolGameId"=${poolGame.id} AND "teamBetId"=${poolGame.game.homeTeamId}`,
      prisma.$executeRaw`UPDATE "PoolGamePick" SET "resultWonLoss" = -1 * "amountBet", "isScored" = true WHERE "poolGameId"=${poolGame.id} AND "teamBetId"=${poolGame.game.awayTeamId}`,
    ]);
  } else if (
    poolGame.game.homeTeamScore + poolGame.homeSpread <
    poolGame.game.awayTeamScore
  ) {
    return prisma.$transaction([
      prisma.$executeRaw`UPDATE "PoolGamePick" SET "resultWonLoss" = "amountBet", "isScored" = true WHERE "poolGameId"=${poolGame.id} AND "teamBetId"=${poolGame.game.awayTeamId}`,
      prisma.$executeRaw`UPDATE "PoolGamePick" SET "resultWonLoss" = -1 * "amountBet", "isScored" = true WHERE "poolGameId"=${poolGame.id} AND "teamBetId"=${poolGame.game.homeTeamId}`,
    ]);
  } else {
    return prisma.$executeRaw`UPDATE "PoolGamePick" SET "isScored" = true WHERE "poolGameId"=${poolGame.id}`;
  }
}
