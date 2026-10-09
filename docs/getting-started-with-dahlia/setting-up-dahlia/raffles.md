# /raffle

Raffles work like giveaways, except members **buy tickets**, with IURA or ores. Every ticket is a chance to win: a member holding 3 tickets is three times as likely to be drawn as one holding 1.

{% hint style="info" %}
Raffles are available on the **Premium**, **Enterprise** and **Megura** plans. `/raffle` is limited to server admins by default; you can allow other roles in **Server Settings → Integrations → Dahlia**.
{% endhint %}

### Starting a Raffle

```javascript
/raffle start prize:<prize> duration:<duration> currency:<IURA|Ores> price:<price> [winners:<1-20>] [max_tickets:<1-100>] [channel:<channel>]
```

* `prize`: what the winners get (up to 256 characters).
* `duration`: how long it runs, between 1 minute and 30 days, for example `30m`, `12h` or `3d`.
* `currency`: what tickets are paid with: **IURA** from the member's wallet, or **Ores**.
* `price`: the price of one ticket.
* `winners`: how many winners to draw (default 1).
* `max_tickets`: the most tickets one member can hold (default 10).
* `channel`: where to post it (default: the channel you run the command in).

### Buying Tickets (Members)

1. Click **Buy tickets** on the raffle.
2. Enter how many tickets you want.
3. Dahlia takes the price from your IURA wallet or your ores, and tells you how many tickets you now hold.

You can buy more later, up to the raffle's limit. If you can't afford the tickets, or they would take you over the limit, nothing is charged.

{% hint style="success" %}
Members need a voyager profile to buy tickets. They can create one with `/start`.
{% endhint %}

### Where the Payments Go

* **IURA** spent on tickets is removed from circulation.
* **Ores** go to the server's wallet, like [special shop](../playing-the-game/specialshop.md) purchases.

### When It Ends

At the end time, Dahlia draws the winners (weighted by tickets, and never the same member twice), updates the post and announces them. Raffles end on time even if the bot restarts.

### Managing Raffles

| Command | Does |
| --- | --- |
| `/raffle end id:<id>` | Ends a raffle now and draws the winners. |
| `/raffle reroll id:<id> [winners:<n>]` | Draws new winners for an ended raffle. Previous winners are never drawn again. |
| `/raffle cancel id:<id>` | Cancels a running raffle and **refunds every ticket**. Members who have since reset their profile can't be refunded; Dahlia tells you how many. |
| `/raffle list` | Shows the running raffles, with their IDs, ticket prices and end times. |

Starting and cancelling raffles is recorded in `/setup history` and the logs channel.

{% hint style="info" %}
Dahlia stores each raffle's details and, for every member who bought tickets, their Discord user ID and ticket count. See [Privacy and Data](../../privacy-and-data.md).
{% endhint %}
