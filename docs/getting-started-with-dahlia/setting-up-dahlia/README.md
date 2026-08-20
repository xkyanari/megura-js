# 🛠 Setting up Dahlia

Dahlia is a versatile bot for Discord servers. While it is primarily a storytelling bot, she can also help with server management, including setup logs, verification with Captcha, whitelist shops, and roles.

However, Dahlia does not scan servers for permissions and privileges by default, as she does not require the administrator role. Dahlia also does not require Discord's privileged Message Content, Server Members, or Presence gateway intents. That means she uses slash commands and explicit interactions instead of reading normal channel conversations, member list updates, or presence activity.

{% hint style="danger" %}
She can be given administrator role but please take caution. Doing this will override a lot of permission checks from her and be able to execute commands if left unchecked. For example, she can delete channels without confirmation if you executed a command such as `/close`. This is irreversible!
{% endhint %}

Please note that Dahlia is still in beta version and improves over time. If you encounter any errors while executing a command, please contact us immediately.
