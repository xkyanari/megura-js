# /upgrade, /craft and /salvage

Gear can be made stronger with **upgrades**, and new gear that the shop doesn't sell can be **crafted**. Both use **materials**.

### Materials

Materials come in four tiers that follow item level. **Metals** are for weapons; **hides and silks** are for armor and accessories.

| Item level | Weapons | Armor and accessories |
| --- | --- | --- |
| 1–19 | Iron Shard | Rough Hide |
| 20–39 | Silver Ore | Spirit Silk |
| 40–59 | Mythril Chunk | Wyrm Scale |
| 60+ | Starmetal | Phoenix Down |

**Arcane Dust** goes into many recipes.

Where to get them:

* **Monsters:** each `/attack` win has a 25% chance to drop a material of your level's tier.
* **Exploring:** `/explore search` can turn up 1–3 materials of the tier the location opens at, so further places give rarer ones.
* **Salvage:** `/salvage` breaks gear you don't need into its tier's material plus Arcane Dust.
* **The shop:** Iron Shard, Rough Hide and Arcane Dust are sold under **Materials** in `/shop`. Rarer materials can't be bought.

### Upgrades

`/upgrade id:<item>` raises a weapon, armor or accessory by one level, up to **+5**. Each level adds **10% of the item's base stats**, so a +5 item has 150% of its base stats. The autocomplete shows the next level's cost and odds.

Each try costs IURA and materials of the item's tier, rising with each level. Higher levels can fail:

| Upgrading to | Chance | If it fails |
| --- | --- | --- |
| +1 | 100% | — |
| +2 | 90% | The cost is spent; the item keeps its level. |
| +3 | 75% | The cost is spent, and the item **drops one level**. |
| +4 | 60% | The cost is spent, and the item **drops one level**. |
| +5 | 45% | The cost is spent, and the item **drops one level**. |

{% hint style="info" %}
Add `ward:True` to use a **Ward Stone**: if the upgrade fails, the item keeps its level. The stone is used up either way, and only on upgrades to +3 and above. Ward Stones are crafted.
{% endhint %}

An upgrade applies to every copy of that item you own, whether equipped or not. If the item is equipped, your stats change right away. Selling or salvaging your **last** copy loses the upgrade.

### Crafting

* `/craft recipes` lists every recipe, with how much of each input you have.
* `/craft make recipe:<item> amount:<n>` crafts it.

Each recipe needs a minimum level. Crafted items are a little stronger than shop gear of the same level, and they **can't be bought**.

| Item | Level | Notes |
| --- | --- | --- |
| Ward Stone | 1 | Protects an upgrade from dropping a level. |
| Hearty Stew | 5 | A consumable that heals 800. |
| Emberforged Blade / Hidebound Vest | 10 | Tier 1 weapon and armor. |
| Silverstorm Saber / Spiritweave Robe | 30 | Tier 2 weapon and armor. |
| Mythril Glaive / Wyrmscale Aegis | 50 | Tier 3 weapon and armor. |
| Starfall Edge / Phoenix Mantle | 66 | Tier 4 weapon and armor. |

### Salvage

`/salvage id:<item> amount:<n>` breaks unequipped weapons, armor or accessories into materials. Each copy gives:

* its tier's material: 1, plus 1 for every 1,000 IURA the item costs, up to 5
* 1 Arcane Dust

Salvaging your last copy of an upgraded item also returns 1 extra material per upgrade level.
