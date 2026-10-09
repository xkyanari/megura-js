# /quests and /factions

### Quests

`/quests` shows your quests for today and this week. You get **3 daily quests** and **1 weekly quest**, such as:

* Win monster fights with `/attack`
* Find items on monsters
* Win duels you start with `/duel`
* Defeat monsters of the rival faction (only if you've joined a faction)
* Search with `/explore`

Quests complete on their own as you play. The reward (IURA and EXP, bigger at higher levels) is paid the moment a quest is done, and the fight or duel result tells you when that happens. New daily quests arrive at midnight UTC, and new weekly quests every Monday at midnight UTC.

`/daily` is separate: it is still the once-a-day story quest with a streak bonus.

### Factions

Every monster belongs to **Margaretha** or **Cerberon**. Join one with `/factions join`, or get its role from your server's admins (they set the faction roles up with `/setup factions`; your faction is whichever of those roles you hold). As a member:

* You deal **+15% damage** to monsters of the rival faction. The fight title shows when you meet one.
* Every rival monster you defeat scores **1 point** for your faction.

`/factions standings` shows this week's and last week's standings with your server's names for each faction, how many points you have scored this week, and last season's result. Weeks start on Monday (UTC).

### Faction Seasons

Every Monday at 00:05 UTC, last week is settled:

* The faction with more points **wins the week**. A tie, or a week nobody scored in, has no winner.
* Every member who scored at least one point for the winning side is paid IURA: **100 × their level**, for the week's top scorer, and at least half of that for everyone else, depending on how many points they scored.
* If the server has a **champion role**, it moves to this week's winners and is taken back from last week's.

Moderators set up the announcements with `/factions setup channel:<#channel> role:<@role>`. The role is optional. To give it out, Dahlia needs the **Manage Roles** permission, and her role must be above the champion role.

### Selling Items

`/sell id:<item> amount:<n>` sells items back to the shop for **40% of their price** (at least 1 IURA each). Only items you aren't wearing can be sold: unequip them first. Items from your server's special shop can't be sold.
