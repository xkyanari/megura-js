# /giveaway

Run giveaways in your server: members enter with a button, and when time is up Dahlia draws the winners at random and announces them.

{% hint style="info" %}
Giveaways are available on the **Premium**, **Enterprise** and **Megura** plans. `/giveaway` is limited to server admins by default; you can allow other roles in **Server Settings → Integrations → Dahlia**.
{% endhint %}

### Starting a Giveaway

```javascript
/giveaway start prize:<prize> duration:<duration> [winners:<1-20>] [channel:<channel>]
```

* `prize`: what the winners get (up to 256 characters).
* `duration`: how long it runs, between 1 minute and 30 days. Use one unit: `30m`, `12h`, `3d`.
* `winners`: how many winners to draw (default 1, up to 20).
* `channel`: where to post it (default: the channel you run the command in).

Dahlia posts the giveaway with an **Enter** button. Each giveaway has an ID, shown at the bottom of the post, which the other commands use.

### Entering (Members)

Click **Enter** to join. Click it again to leave. Only you see the confirmation, along with how many people have entered so far. Each member is entered once, however many times they click.

### When It Ends

At the end time, Dahlia:

1. picks the winners at random from everyone who entered,
2. updates the post to show the winners and disables the **Enter** button,
3. announces the winners in the same channel.

If fewer people entered than there are winners, everyone who entered wins. If nobody entered, Dahlia says so.

Giveaways end on time even if the bot restarts in the meantime.

### Managing Giveaways

| Command | Does |
| --- | --- |
| `/giveaway end id:<id>` | Ends a giveaway now and draws the winners. |
| `/giveaway reroll id:<id> [winners:<n>]` | Draws new winners for an ended giveaway, for example if a winner doesn't respond. Previous winners are never drawn again. |
| `/giveaway cancel id:<id>` | Cancels a running giveaway without drawing anyone. |
| `/giveaway list` | Shows the running giveaways, with their IDs and end times. |

Starting and cancelling giveaways is recorded in `/setup history` and the logs channel.

{% hint style="info" %}
Dahlia stores each giveaway's details and the Discord user IDs of the members who entered and won. See [Privacy and Data](../../privacy-and-data.md).
{% endhint %}
