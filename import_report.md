# CSV Import Report

Produced on: 6/15/2026, 4:15:43 AM
Source: `expenses_export.csv`

## Import Summary
* **Total Rows Parsed**: 42
* **Clean Rows**: 28
* **Anomalies Found**: 14

---

## Detailed Anomalies Log

This table lists every anomaly detected in the CSV file and the correction applied by the app importer.

| Row | Date | Description | Issue Detected | Proposed Correction / Action Taken |
|:---:|:---|:---|:---|:---|
| 2 | 2026-02-01 | February rent | *None (Clean row)* | *No action needed*  |
| 3 | 2026-02-03 | Groceries BigBasket | *None (Clean row)* | *No action needed*  |
| 4 | 2026-02-05 | Wifi bill Feb | *None (Clean row)* | *No action needed*  |
| 5 | 2026-02-08 | Dinner at Marina Bites | *None (Clean row)* | *No action needed*  |
| 6 | 2026-02-08 | dinner - marina bites | Duplicate row: matches row 5 in date, payer, and amount. | Merged duplicate: Discarding this row (Row 6) and keeping Row 5. **(Row Discarded)** |
| 7 | 2026-02-10 | Electricity Feb | *None (Clean row)* | *No action needed*  |
| 8 | 2026-02-12 | Maid salary Feb | *None (Clean row)* | *No action needed*  |
| 9 | 2026-02-14 | Movie night snacks | *None (Clean row)* | Standardized payer name "priya" to "Priya".  |
| 10 | 2026-02-15 | Cylinder refill | High decimal precision rounded from 899.995 to 900 | Cleaned amount formatting: High decimal precision rounded from 899.995 to 900.  |
| 11 | 2026-02-18 | Groceries DMart | *None (Clean row)* | Standardized payer name "Priya S" to "Priya".  |
| 12 | 2026-02-20 | Aisha birthday cake | *None (Clean row)* | *No action needed*  |
| 13 | 2026-02-22 | House cleaning supplies | Payer is missing/empty. | Missing payer: default-assigned to Aisha (requires approval).  |
| 14 | 2026-02-25 | Rohan paid Aisha back | Settlement logged as an expense: "Rohan paid Aisha back". | Reclassified expense as a direct payment from Rohan to Aisha.  |
| 15 | 2026-02-28 | Pizza Friday | Percentage splits sum is 110%, not 100%. | Normalized percentage splits from 110% to 100% proportionally.  |
| 16 | 01/03/2026 | March rent | *None (Clean row)* | *No action needed*  |
| 17 | 03/03/2026 | Groceries BigBasket | *None (Clean row)* | *No action needed*  |
| 18 | 05/03/2026 | Wifi bill Mar | *None (Clean row)* | *No action needed*  |
| 19 | 08/03/2026 | Goa flights | *None (Clean row)* | *No action needed*  |
| 20 | 09/03/2026 | Goa villa booking | *None (Clean row)* | Converted USD to INR at a fixed rate of 83.00 (₹44820 INR).  |
| 21 | 10/03/2026 | Beach shack lunch | *None (Clean row)* | Converted USD to INR at a fixed rate of 83.00 (₹6972 INR).  |
| 22 | 10/03/2026 | Scooter rentals | *None (Clean row)* | *No action needed*  |
| 23 | 11/03/2026 | Parasailing | Dev's friend Kabir is in the split list but is not a group member. | Converted USD to INR at a fixed rate of 83.00 (₹12450 INR).<br>Kabir is a guest. Split 5-ways, but Dev absorbs Kabir's share. Dev's split will include his own and Kabir's share.  |
| 24 | 11/03/2026 | Dinner at Thalassa | Conflict: Thalassa dinner logged by both Aisha (₹2400) and Rohan (₹2450). Notes suggest Aisha's is wrong. | Conflict: Discarding Aisha's Thalassa entry (₹2400) and keeping Rohan's (₹2450). **(Row Discarded)** |
| 25 | 11/03/2026 | Thalassa dinner | *None (Clean row)* | Conflict resolution: Retaining Rohan's Thalassa dinner entry (₹2450) based on notes.  |
| 26 | 12/03/2026 | Parasailing refund | *None (Clean row)* | Converted USD to INR at a fixed rate of 83.00 (₹-2490 INR).  |
| 27 | Mar 14 | Airport cab | *None (Clean row)* | Standardized payer name "rohan" to "Rohan".  |
| 28 | 15/03/2026 | Groceries DMart | Missing currency: defaulted to INR. | Assigned default currency "INR" for empty currency column.  |
| 29 | 18/03/2026 | Electricity Mar | *None (Clean row)* | *No action needed*  |
| 30 | 20/03/2026 | Maid salary Mar | *None (Clean row)* | *No action needed*  |
| 31 | 22/03/2026 | Dinner order Swiggy | Expense amount is zero (marked for deletion/fixing later in CSV). | Detected zero-amount placeholder expense. Staged to be skipped/discarded. **(Row Discarded)** |
| 32 | 25/03/2026 | Weekend brunch | Percentage splits sum is 110%, not 100%. | Normalized percentage splits from 110% to 100% proportionally.  |
| 33 | 28/03/2026 | Meera farewell dinner | *None (Clean row)* | *No action needed*  |
| 34 | 04/05/2026 | Deep cleaning service | *None (Clean row)* | *No action needed*  |
| 35 | 2026-04-01 | April rent | *None (Clean row)* | *No action needed*  |
| 36 | 2026-04-02 | Groceries BigBasket | Member "Meera" was inactive on 2026-04-02 but included in split. | Excluded inactive member "Meera" from split list on 2026-04-02.  |
| 37 | 2026-04-05 | Wifi bill Apr | *None (Clean row)* | *No action needed*  |
| 38 | 2026-04-08 | Sam deposit share | Settlement logged as an expense: "Sam deposit share". | Reclassified expense as a direct payment from Sam to Aisha.  |
| 39 | 2026-04-10 | Housewarming drinks | Member "Sam" was inactive on 2026-04-10 but included in split. | Excluded inactive member "Sam" from split list on 2026-04-10.  |
| 40 | 2026-04-12 | Electricity Apr | Member "Sam" was inactive on 2026-04-12 but included in split. | Excluded inactive member "Sam" from split list on 2026-04-12.  |
| 41 | 2026-04-15 | Groceries DMart | *None (Clean row)* | *No action needed*  |
| 42 | 2026-04-18 | Furniture for common room | *None (Clean row)* | *No action needed*  |
| 43 | 2026-04-20 | Maid salary Apr | *None (Clean row)* | *No action needed*  |

---

## Post-Import Balances Summary

After applying all cleanups and corrections, the calculated net balances in INR for all members are:

| Flatmate | Net Balance (INR) | Status |
|:---|:---:|:---|
| **Aisha** | +₹90,522.6 | Creditor (Owed money) |
| **Rohan** | ₹-54,208.39 | Debtor (Owes money) |
| **Priya** | ₹-61,127.39 | Debtor (Owes money) |
| **Meera** | ₹-20,716.32 | Debtor (Owes money) |
| **Sam** | +₹15,842.5 | Creditor (Owed money) |
| **Dev** | +₹29,687 | Creditor (Owed money) |

### Debt Settlement Plan (Who pays whom)
* **Priya** pays **Aisha** &rarr; **₹61,127.39**
* **Rohan** pays **Aisha** &rarr; **₹29,395.21**
* **Rohan** pays **Dev** &rarr; **₹24,813.18**
* **Meera** pays **Dev** &rarr; **₹4,873.82**
* **Meera** pays **Sam** &rarr; **₹15,842.5**
