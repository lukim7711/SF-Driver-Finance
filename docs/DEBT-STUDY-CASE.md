# Debt Study Case — Real Data Reference

> **Purpose**: This document contains real-world debt data used as the design reference for the loan tracking feature (F03). AI should read this to understand the complexity and data structure of the debt feature.

---

## User Financial Profile

- **Job**: Ojol driver (ShopeeFood / SPX Express)
- **Location**: Jakarta, Indonesia
- **Working hours**: ~8-12 hours/day, ~26 days/month
- **Daily gross income**: Rp120,000 — Rp350,000+ (highly variable)
- **Average gross**: Rp205,000/day
- **Average net**: Rp108,000/day (after operational costs)
- **Goal**: Pay off all debts within 2 months

## Daily Operational Expenses

| Category | Default | Min | Max | Note |
|---|---|---|---|---|
| Fuel (Bensin) | 40,000 | 25,000 | 60,000 | Depends on delivery distance |
| Meals & Drinks | 25,000 | 10,000 | 40,000 | Can bring lunch = 0 |
| Cigarettes | 27,000 | 13,500 | 35,000 | Can reduce/quit |
| Data Plan | 5,000 | 3,000 | 10,000 | Daily package |
| **Total** | **97,000** | **51,500** | **145,000** | |

## Daily Household Expenses

| Category | Default/day | Note |
|---|---|---|
| Groceries & family | 60,000 | Rice, food, parents, etc. |
| Electricity & water | 5,000 | ~150K/month ÷ 30 |
| Emergency | 10,000 | Sickness, repairs, etc. |
| **Total** | **85,000** | |

## Loan Details (as of 12 Feb 2026)

### Loan 1: Shopee Pinjam

| Field | Value |
|---|---|
| Platform | Shopee Pinjam |
| Original amount | Rp3,500,000 |
| Total remaining | Rp4,904,446 (including interest) |
| Late fee | Rp21,346 (5% per month of installment) |
| Total installments | 10 (all unpaid) |
| Monthly amount | Rp435,917 |
| Due day | 13th of each month |
| Late fee type | 5% per month |

**Schedule:**

| # | Due Date | Amount |
|---|---|---|
| 1 | 13 Mar 2026 | Rp435,917 |
| 2 | 13 Apr 2026 | Rp435,917 |
| 3 | 13 May 2026 | Rp435,917 |
| 4 | 13 Jun 2026 | Rp435,917 |
| 5 | 13 Jul 2026 | Rp435,917 |
| 6 | 13 Aug 2026 | Rp435,917 |
| 7 | 13 Sep 2026 | Rp435,917 |
| 8 | 13 Oct 2026 | Rp435,917 |
| 9 | 13 Nov 2026 | Rp435,917 |
| 10 | 13 Dec 2026 | Rp443,930 |

### Loan 2: SPayLater

| Field | Value |
|---|---|
| Platform | SPayLater |
| Total remaining | Rp672,194 |
| Total installments | 5 (all unpaid) |
| Monthly amount | ~Rp162,845 |
| Due day | 1st of each month |
| Late fee type | 5% per month |

**Schedule:**

| # | Due Date | Amount |
|---|---|---|
| 1 | 01 Mar 2026 | Rp162,845 |
| 2 | 01 Apr 2026 | Rp162,845 |
| 3 | 01 May 2026 | Rp162,845 |
| 4 | 01 Jun 2026 | Rp162,861 |
| 5 | 01 Jul 2026 | Rp20,798 |

### Loan 3: SeaBank Pinjam

| Field | Value |
|---|---|
| Platform | SeaBank Pinjam |
| Total remaining | Rp1,627,500 |
| Total installments | 7 (all unpaid) |
| Monthly amount | Rp232,500 (fixed) |
| Due day | 5th of each month |
| Late fee type | 0.25% per day |

**Schedule:**

| # | Due Date | Amount |
|---|---|---|
| 1 | 05 Mar 2026 | Rp232,500 |
| 2 | 05 Apr 2026 | Rp232,500 |
| 3 | 05 May 2026 | Rp232,500 |
| 4 | 05 Jun 2026 | Rp232,500 |
| 5 | 05 Jul 2026 | Rp232,500 |
| 6 | 05 Aug 2026 | Rp232,500 |
| 7 | 05 Sep 2026 | Rp232,500 |

### Loan 4: Kredivo 1

| Field | Value |
|---|---|
| Platform | Kredivo |
| Original amount | Rp2,445,826 |
| Already paid | Rp2,079,055 |
| Remaining | Rp1,006,050 |
| Total installments | 9 (6 already paid) |
| Monthly amount | Rp335,350 |
| Due day | 28th of each month |
| Late fee type | 4% per month |

**Remaining Schedule:**

| # | Due Date | Amount |
|---|---|---|
| 7 | 28 Feb 2026 | Rp335,350 |
| 8 | 28 Mar 2026 | Rp335,350 |
| 9 | 28 Apr 2026 | Rp335,350 |

### Loan 5: Kredivo 2

| Field | Value |
|---|---|
| Platform | Kredivo |
| Original amount | Rp1,109,000 |
| Already paid | Rp662,659 |
| Remaining | Rp641,010 |
| Total installments | 6 (3 already paid) |
| Monthly amount | Rp213,670 |
| Due day | 15th of each month |
| Late fee type | 4% per month |

**Remaining Schedule:**

| # | Due Date | Amount |
|---|---|---|
| 4 | 15 Feb 2026 | Rp213,670 |
| 5 | 15 Mar 2026 | Rp213,670 |
| 6 | 15 Apr 2026 | Rp213,670 |

## Summary

| Platform | Remaining | Monthly | Due Day | Late Fee |
|---|---|---|---|---|
| Shopee Pinjam | Rp4,904,446 | Rp435,917 | 13th | 5%/month |
| SPayLater | Rp672,194 | ~Rp162,845 | 1st | 5%/month |
| SeaBank Pinjam | Rp1,627,500 | Rp232,500 | 5th | 0.25%/day |
| Kredivo 1 | Rp1,006,050 | Rp335,350 | 28th | 4%/month |
| Kredivo 2 | Rp641,010 | Rp213,670 | 15th | 4%/month |
| **GRAND TOTAL** | **Rp8,851,200** | | | |

## Design Implications

This real data drives these requirements:

1. **Multiple loans per user** — support 5+ active loans simultaneously
2. **Different platforms** — same platform can appear multiple times (e.g., Kredivo 1 & 2)
3. **Different due days** — each loan has its own due day (1st, 5th, 13th, 15th, 28th)
4. **Different late fee rules** — some are %/month, some are %/day
5. **Variable last installment** — final installment amount may differ (e.g., Shopee Pinjam last = Rp443,930)
6. **Partial payoff history** — some loans have installments already paid before bot was created
7. **Due date urgency** — bot must highlight which payment is coming next
8. **Monthly total obligation** — sum of all installments due in a given month for budgeting
