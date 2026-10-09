# /boss

Bosses are tougher monsters you fight turn by turn. Each turn the boss shows what it is about to do, and you pick the counter before time runs out. Fight one on your own, or team up with the whole channel against a world boss.

{% hint style="warning" %}
Bosses are part of the upcoming storyline and are switched off for now. They only work in servers whose plan has the `hasBosses` feature turned on.
{% endhint %}

### Reading the Boss

Every turn the boss telegraphs one of three moves. The words change from fight to fight, so watch for what it is doing:

| The boss…                                   | Move    | Counter    |
| ------------------------------------------- | ------- | ---------- |
| raises its arms, winds up, leaps at you     | Smash   | **Dodge**  |
| aims a spike or claw, lunges straight at you | Pierce  | **Guard**  |
| chants, gathers energy, starts to glow      | Channel | **Strike** |

You have between 8 and 15 seconds to choose, and the buttons are in a different order every turn. Your first click is final.

* **The right counter** hits back for 150% damage, and you take no damage.
* **Strike** on the wrong move hits normally, but you take the full blow.
* **Guard** on the wrong move halves the blow but does no damage.
* **Dodge** on the wrong move does nothing, and you take the full blow.
* **Not choosing** means you fight at half strength and take the full blow.

### Solo Challenge

`/boss challenge` starts a fight against a boss sized to your level. You have 12 turns to win. Win, and you get IURA and EXP worth several monster fights plus a guaranteed item drop. Lose, and you get nothing. Either way you can challenge again after 6 hours.

### World Bosses

A world boss appears in a channel with a **Join the fight** button. Everyone who joins before the timer runs out fights it together, for up to 15 turns. The boss is tougher the more fighters join.

A boss counts as a monster for your [quests](quests-and-factions.md). A boss of the rival faction takes your faction's +15% damage bonus, and every fighter who acted scores a faction point when it falls.

When the boss falls, every fighter gets IURA and EXP. Fighters who dealt more damage get more. The item drop goes only to fighters who acted in at least half the turns they were standing.

### Setting Up (Moderators)

Moderators (with the **Moderate Members** permission) can bring world bosses into the story:

* `/boss spawn`: summons a world boss in the current channel. Add `intro` for story text shown when it appears, and `join_minutes` (1 to 10, default 2) for how long fighters can join.
* `/boss autospawn hours:<1-168>`: makes world bosses appear on their own about that often, in the current channel or the one you pick with `channel`. The exact time varies. `hours:0` turns it off.

```javascript
/boss spawn intro:The sky over Merio splits open... join_minutes:3
/boss autospawn hours:12 channel:#battlefield
```
