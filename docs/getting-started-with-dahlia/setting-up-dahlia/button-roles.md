# /roles

Let members pick their own roles. A role panel is a message with one button per role: clicking a button gives the member that role, and clicking it again takes it away.

{% hint style="info" %}
Button roles are available on every plan. `/roles` is limited to server admins by default; you can allow other roles in **Server Settings → Integrations → Dahlia**.
{% endhint %}

### Before You Start

* Dahlia needs the **Manage Roles** permission.
* Dahlia can only give out roles that are **below its own role**. If a role is higher, drag Dahlia's role above it in **Server Settings → Roles**.
* `@everyone` and roles managed by an integration (bot roles, the booster role) can't be given out.

### Creating a Panel

1. Create the panel:

   ```javascript
   /roles create title:<title> [description:<text>]
   ```

   Dahlia replies with the panel's ID.
2. Add up to 25 roles:

   ```javascript
   /roles add panel:<id> role:<role> [label:<button text>] [emoji:<emoji>]
   ```

   The button shows the role's name unless you give a `label`. Running `/roles add` again for a role that's already on the panel changes its label or emoji.
3. Post it:

   ```javascript
   /roles post panel:<id> [channel:<channel>]
   ```

Changes you make after posting (adding or removing roles) update the posted panel straight away. Posting a panel again moves it: the previous post is deleted.

### Managing Panels

| Command | Does |
| --- | --- |
| `/roles remove panel:<id> role:<role>` | Removes a role from the panel. Members keep the role if they already have it. |
| `/roles list` | Shows the server's panels, how many roles each has, and where they're posted. |
| `/roles delete panel:<id>` | Deletes the panel and its posted message. |

{% hint style="warning" %}
If you let staff use `/roles`, they can only add roles that are below their own highest role, so nobody can hand out a role above their own. The server owner can add any role Dahlia can give.
{% endhint %}

Creating and deleting panels, and adding or removing roles, is recorded in `/setup history` and the logs channel.
