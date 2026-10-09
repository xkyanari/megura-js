# /specialshop

The **special shop** is each server's own store. Admins stock it with real-world or community rewards (whitelist spots, event items, digital items, NFTs, crypto), and voyagers buy them with **ores**. The server team then fulfils each order by hand.

### Setting Up (Admins)

1. Choose the channel where orders are announced to your team, and the channel where buyers are told when their order's status changes:
   ```javascript
   /setup mods channel:#orders
   /setup shop channel:#shop-updates
   ```
   Dahlia needs the **Manage Webhooks** permission in both channels.
2. Add items:
   ```javascript
   /specialshop additem item:<name> price:<ores> stock:<amount> category:<category> itemid:<id>
   ```
   * `category`: Whitelist, Event Items, Digital Items, NFTs or Cryptocurrencies.
   * `itemid`: a short unique ID with no spaces, used by the other commands.
3. Post the shop so voyagers can browse it:
   ```javascript
   /specialshop browse
   ```

{% hint style="info" %}
`/specialshop` is limited to members with **Moderate Members** by default. Server owners can change who can use it in **Server Settings → Integrations → Dahlia**.
{% endhint %}

#### Managing Items

| Command | Does |
| --- | --- |
| `/specialshop setprice itemid:<id> price:<ores>` | Changes an item's price. |
| `/specialshop setstock itemid:<id> stock:<amount>` | Sets how many are left. |
| `/specialshop removeitem itemid:<id>` | Removes an item. |
| `/specialshop transfer user:<voyager> amount:<ores>` | Gives ores from the server's wallet to a voyager, for example as a reward. |

### Buying (Voyagers)

1. On the posted shop, pick a category, then the item.
2. The item's price is taken from your ores and its stock goes down by one.
3. Your team is notified in the orders channel, and Dahlia tells you the order was placed.

You can't buy an item that's sold out, or one you can't afford; in both cases nothing is taken.

{% hint style="success" %}
Ores are earned in arena events and brawls, or given by admins. Players need a voyager profile, created with `/start`.
{% endhint %}

### Handling Orders (Admins)

Each order in the orders channel has three buttons:

| Button | Effect |
| --- | --- |
| **Processing** | Marks the order as being worked on and lets the buyer know in the `/setup shop` channel. |
| **Completed** | Marks the order as fulfilled and lets the buyer know. |
| **Cancelled** | Cancels the order, refunds the ores to the buyer and puts the item back in stock. |

A cancellation refunds only once, even if the button is clicked twice. If the buyer has since reset their profile, the order is still cancelled but there's no one to refund, so the ores stay in the server's wallet.

{% hint style="info" %}
Ores spent in the special shop go to the server's wallet, and refunds come out of it.
{% endhint %}
