import { Authenticator } from "remix-auth";
import { SocialsProvider, DiscordStrategy } from "remix-auth-socials";
import { sessionStorage } from "~/services/session.server";
import type { User } from "./models/user.server";
import { updateUser } from "./models/user.server";
import { createUser, getUserByDiscordId } from "./models/user.server";
import {
  SERVER_DISCORD_ADMIN_ROLE_ID,
  SERVER_DISCORD_ID,
} from "./utils/constants";

// Create an instance of the authenticator
export let authenticator = new Authenticator<User>(sessionStorage, {
  sessionKey: "_session",
});
// You may specify a <User> type which the strategies will return (this will be stored in the session)
// export let authenticator = new Authenticator<User>(sessionStorage, { sessionKey: '_session' });

authenticator.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_SECRET,
      callbackURL: `${process.env.WEBSITE_URL}/auth/${SocialsProvider.DISCORD}/callback`,
      scope: ["identify", "guilds.members.read"],
    },
    async (props) => {
      const resGuildMember = await fetch(
        `https://discord.com/api/users/@me/guilds/${SERVER_DISCORD_ID}/member`,
        {
          headers: {
            Authorization: `${props.extraParams.token_type} ${props.accessToken}`,
          },
        }
      );
      const jsonGuild = await resGuildMember.json();
      console.log(jsonGuild);

      const avatarPath = jsonGuild.avatar
        ? `guilds/${SERVER_DISCORD_ID}/users/${props.profile.id}/avatars/${jsonGuild.avatar}.webp`
        : props.profile.__json.avatar
        ? `avatars/${props.profile.id}/${props.profile.__json.avatar}.webp`
        : "";
      const userName = jsonGuild.nick ?? props.profile.displayName;

      let user = await getUserByDiscordId(props.profile.id);
      if (!user) {
        user = await createUser(props.profile.id, userName, avatarPath);
      }

      user.discordName = userName;
      user.discordAvatar = avatarPath;
      user.discordRoles = jsonGuild.roles;

      user = await updateUser(user);

      return user;
    }
  )
);

export const isAdmin = (user: User) => {
  return user.discordRoles.includes(SERVER_DISCORD_ADMIN_ROLE_ID);
};

export const requireAdmin = (user: User) => {
  if (!isAdmin(user)) {
    throw new Error("You do not have access to this page.");
  }

  return true;
};
