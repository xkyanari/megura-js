# /form

Collect applications, reports or feedback. Members click **Fill in**, answer up to five questions in a pop-up, and Dahlia posts their answers to a channel you choose.

{% hint style="info" %}
Forms are available on every plan. `/form` is limited to server admins by default; you can allow other roles in **Server Settings → Integrations → Dahlia**. Members don't need it: they use the button.
{% endhint %}

### Creating a Form

1. Create the form and choose where answers go. A private staff channel works well:

   ```javascript
   /form create title:<title> responses:<channel> [description:<text>]
   ```

   The title (up to 45 characters) is shown at the top of the pop-up. Dahlia needs to be able to send messages and embeds in the responses channel.
2. Add up to five questions:

   ```javascript
   /form field add form:<id> label:<question> [style:<Short|Paragraph>] [required:<True|False>] [placeholder:<hint>]
   ```

   * `label`: the question, up to 45 characters.
   * `style`: a one-line box (default) or a paragraph box.
   * `required`: whether it must be answered (default yes).
   * `placeholder`: a hint shown in the empty box.
3. Post the **Fill in** button:

   ```javascript
   /form post form:<id> [channel:<channel>]
   ```

   Posting a form again moves it: the previous post is deleted.

{% hint style="info" %}
Discord's pop-ups hold at most five questions and answers of up to 1024 characters each. For longer forms, create a second form.
{% endhint %}

### Answering (Members)

Click **Fill in**, answer the questions and press **Submit**. Your answers are posted to the server's responses channel along with your name, and you'll see a confirmation only you can see.

### Managing Forms

| Command | Does |
| --- | --- |
| `/form list` | Shows the server's forms, their questions (numbered), and where they're posted. |
| `/form field remove form:<id> number:<n>` | Removes question `n`. The other questions keep their order. |
| `/form delete form:<id>` | Deletes the form and its posted button. Answers already posted stay in the responses channel. |

Changes to questions apply straight away, even to the button you already posted.

Creating and deleting forms, and adding or removing questions, is recorded in `/setup history` and the logs channel.

{% hint style="info" %}
Dahlia stores each form's questions, but not the answers: those are only posted to your responses channel. See [Privacy and Data](../../privacy-and-data.md).
{% endhint %}
