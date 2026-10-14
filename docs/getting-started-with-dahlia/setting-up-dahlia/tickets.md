# /ticket

Give members a private line to your staff. A member clicks **Open ticket** and Dahlia creates a channel that only they, your staff role and server admins can see. When the issue is sorted, either side clicks **Close** and the channel is deleted.

{% hint style="info" %}
Tickets are available on every plan. `/ticket` is limited to server admins by default; you can allow other roles in **Server Settings → Integrations → Dahlia**. Members don't need it: they use the buttons.
{% endhint %}

### Setting Up

1. Choose who answers tickets, and optionally a category for the ticket channels:

   ```javascript
   /ticket setup staff_role:<role> [category:<category>]
   ```

   Run it again any time to change either one.
2. Post the button where members can see it, for example in a #support channel:

   ```javascript
   /ticket panel [channel:<channel>] [message:<text>]
   ```

   `message` replaces the default text above the button.

Dahlia needs the **Manage Channels** permission. If you use a category, Dahlia also needs to be able to see it and manage channels in it.

### Opening a Ticket (Members)

Click **Open ticket**. Dahlia creates a channel named `ticket-<number>`, mentions you and the staff role there, and replies with a link to it.

Each member can have **one open ticket** at a time. Clicking the button again takes you back to your open ticket.

### Closing a Ticket

Click **Close** on the first message in the ticket, or run `/ticket close` in the ticket channel. The member who opened the ticket, anyone with the staff role, and anyone who can manage channels can close it. The channel is deleted 10 seconds later.

If a ticket channel is deleted by hand, its member can open a new ticket straight away.

{% hint style="warning" %}
Dahlia doesn't keep a transcript. Once a ticket's channel is deleted, its messages are gone. Copy anything you need before closing.
{% endhint %}

Opening and closing tickets, and `/ticket setup` changes, are recorded in `/setup history` and the logs channel.

{% hint style="info" %}
Dahlia stores who opened and closed each ticket, and when, but not the messages in it. See [Privacy and Data](../../privacy-and-data.md).
{% endhint %}
