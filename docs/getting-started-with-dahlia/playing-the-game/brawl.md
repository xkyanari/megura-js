# /brawl

A **brawl** is a one-on-one, best-of-five duel where two voyagers wager ores. Anyone can post a challenge, the first voyager to accept fights it out in a private channel, and the winner takes the whole pot.

### Setting Up (Admins)

Admins set up brawls with two subcommands:

* `/brawl start`: posts the notice board, with a **Start a Brawl** button, in the current channel.
* `/brawl channel`: picks the channel where Dahlia posts the scoreboard after each brawl.

```javascript
/brawl start
/brawl channel channel:#brawl-results
```

{% hint style="info" %}
Dahlia needs the **Manage Channels** permission to create the private brawl channels, and **Manage Webhooks** to post the scoreboard.
{% endhint %}

### Posting a Challenge

1. Click **Start a Brawl** on the notice board.
2. Enter your wager in ores. It must be a whole number of at least 1.
3. Dahlia posts your challenge with an **Accept** button.

Your wager is taken from your ores **as soon as the challenge is posted** and held by the server until the brawl is decided. If you don't have enough ores, the challenge isn't posted and nothing is taken.

{% hint style="success" %}
Players need a voyager profile to brawl. They can create one with the `/start` command.
{% endhint %}

### Accepting a Challenge

Click **Accept** on someone else's challenge. You need the same number of ores as the wager, and it's held the same way. Only the first voyager to accept gets in; anyone who clicks after that is told the challenge has already been accepted. You can't accept your own challenge.

Once accepted, Dahlia opens a private channel for the two of you and the fight begins.

### Fighting

* The brawl has up to **5 rounds**, and the first voyager to win **3 rounds** wins.
* Each round, you have **30 seconds** to pick a move. Your first pick is final.
* The four moves beat each other like rock-paper-scissors:

| Move | Strong against | Weak against |
| --- | --- | --- |
| Range | Melee, Block | Dash |
| Melee | Block, Dash | Range |
| Block | Dash | Range, Melee |
| Dash | Range | Melee, Block |

The private channel is deleted a few seconds after the result is announced, and the scoreboard is posted to the brawl channel.

### Payouts

| Outcome | What happens |
| --- | --- |
| You win | You receive the whole pot: your wager back plus your opponent's. |
| You lose | Your wager goes to the winner. |
| Draw | Both wagers are returned. |
| Nobody accepts within **10 minutes** | The challenge expires and your wager is returned. |
| The brawl can't start or is interrupted | Both wagers are returned. |

Every payout happens exactly once, even if the bot restarts in the middle of a brawl. Expiry and refunds are scheduled in a way that survives restarts.

{% hint style="info" %}
On test servers (testnet), brawls work the same way but no ores are taken or paid out.
{% endhint %}
