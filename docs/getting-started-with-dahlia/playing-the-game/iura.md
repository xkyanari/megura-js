# /iura

**IURA** is the in-game currency. Every voyager has three balances:

* **Wallet**: what you spend, send and receive.
* **Bank**: savings, moved in and out of your wallet.
* **Stake**: IURA set aside from your bank.

The **/iura** command shows and moves your balances. Every reply is visible only to you.

### Checking Your Balance

```javascript
/iura balance
/iura balance view:Bank
```

`view:Wallet` (the default) shows your wallet. `view:Bank` shows your bank and staked amounts.

### Moving IURA

| Command | Moves |
| --- | --- |
| `/iura wallet deposit:<amount>` | Wallet → Bank |
| `/iura wallet withdraw:<amount>` | Bank → Wallet |
| `/iura bank stake:<amount>` | Bank → Stake |
| `/iura bank unstake:<amount>` | Stake → Bank |

Amounts must be whole numbers of at least 1. You can't move more than the source balance holds; if you try, nothing moves and Dahlia tells you so.

{% hint style="info" %}
Staked IURA is set aside but doesn't earn rewards yet. Staking rewards are planned for a future update.
{% endhint %}

### Naming Your Wallet and Bank

```javascript
/iura wallet name:<new name>
/iura bank name:<new name>
```

Names are up to 20 characters and must be unique; Dahlia tells you if a name is already taken.

### Earning IURA

* **Daily quest**: `/daily`, once every 24 hours.
* **Duels**: the winner of a `/duel` takes 40% of the loser's wallet (rounded down), worked out when the battle ends.
* **Voting** for Dahlia on top.gg or Discord Bot List: 50 IURA per vote, doubled on weekends.
* **Gifts** from other voyagers, see below.

### Sending IURA to Another Voyager

* **Gift**: right-click (or long-press) a voyager, choose **Apps → Transfer IURA**, and 30 IURA is sent from your wallet.
* **Transfer**: admins (and anyone they allow) can send any amount with `/transfer player:<voyager> amount:<amount>`.

Both voyagers need a profile on the server, and you can't send IURA to yourself. A transfer either completes in full or doesn't happen at all: you're never charged without the other voyager receiving it.

### Spending IURA

IURA buys items from `/shop` (in bulk with `/buy`). Purchases only go through if your wallet covers the full price.

{% hint style="success" %}
Players need a voyager profile to use IURA. They can create one with the `/start` command.
{% endhint %}
