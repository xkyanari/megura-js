# /schedule

Post messages automatically on a schedule, and create Discord server events.

{% hint style="info" %}
Scheduling is available on the **Enterprise** and **Megura** plans. `/schedule` is limited to server admins by default; you can allow other roles in **Server Settings → Integrations → Dahlia**.
{% endhint %}

## Scheduled Posts

### Adding a Post

```javascript
/schedule post add channel:<channel> message:<text> every:<interval>
/schedule post add channel:<channel> message:<text> cron:<schedule> [timezone:<zone>]
```

Give **one** of:

* `every`: a repeat interval such as `30m`, `6h` or `1d`. The first post goes out within one interval; Dahlia tells you exactly when.
* `cron`: a [cron schedule](https://crontab.guru/) for fixed times. Use five fields: minute, hour, day of month, month, day of week.

| Cron | Posts |
| --- | --- |
| `0 9 * * *` | every day at 9:00 |
| `0 9 * * 1` | Mondays at 9:00 |
| `30 18 * * 1-5` | weekdays at 18:30 |
| `0 12 1 * *` | the 1st of every month at noon |

`timezone` sets the clock that cron times use, for example `Asia/Manila`, `Europe/London` or `America/New_York`. It's UTC by default.

Posts can go out at most once every 10 minutes, and a server can have up to 25 scheduled posts. Dahlia needs **View Channel** and **Send Messages** in the channel. Mentions in the message (users, roles, `@everyone` if Dahlia is allowed to use it) ping as usual.

### Managing Posts

| Command | Does |
| --- | --- |
| `/schedule post list` | Shows every scheduled post, its schedule, when it next runs, and the start of its message. |
| `/schedule post remove id:<id>` | Stops and deletes a scheduled post. |

Scheduled posts keep running after the bot restarts. If a post's channel is deleted, Dahlia pauses the post and says so in the logs channel.

## Server Events

```javascript
/schedule event create name:<name> start:<time> [end:<time>] [channel:<voice or stage channel>] [location:<place or link>] [description:<text>] [timezone:<zone>]
```

* `start` and `end`: a date and time such as `2026-10-20 18:30`, in `timezone` (UTC by default), or a delay from now such as `2h` or `3d`.
* Give **either** a voice or stage `channel` for the event to happen in, **or** a `location` (a place or a link). Events at a location need an end time; if you don't give one, the event lasts an hour.

Dahlia needs the **Manage Events** permission. The event appears in the server's Events list, where members can mark themselves as interested.

Adding and removing scheduled posts, and creating events, is recorded in `/setup history` and the logs channel.
