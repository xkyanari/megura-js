# /sales

`/sales` shows how your server's **special shop** is doing. Only members with the **Moderate Members** permission can use it, and Dahlia answers only to you.

```javascript
/sales
/sales period:Last 7 days
/sales period:All time export:True
```

* `period`: the last 7 days, the last 30 days (the default), or all time.
* `export`: also attaches every order in the period as a CSV file (order number, buyer's Discord ID, item, ores paid, status, and when it was ordered), ready for a spreadsheet.

The report shows:

* **Orders by status**: pending, processing, completed and cancelled.
* **Revenue**: the ores paid for completed orders. Cancelled orders are refunded, so they don't count.
* **Top items**: the five best sellers, with what they earned.
* **Oldest waiting orders**: pending and processing orders, oldest first, so nothing is forgotten.

Every special-shop purchase is recorded, whether or not you have set up a staff channel for order notifications. Orders keep the price that was paid, so a cancellation refunds exactly that, even if the item's price has changed since.

{% hint style="info" %}
Orders placed before sales tracking was added have no price or date. They appear under **All time**, and the report tells you how many completed orders it couldn't add to the revenue.
{% endhint %}
