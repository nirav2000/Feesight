# Feesight
School Fees Analyser

🧠 Feesight — App Summary
Feesight is a school fees financial planning and simulation tool that helps parents understand, plan, and stress test how to pay for private education.
🎯 Core Purpose
The app answers:
“Can I afford school fees — and what’s the best way to fund them?”
It does this by combining:
real school fee data
real investment return data
financial modelling
⚙️ What the App Does
1. 📊 School Fee Modelling
Users input or select a school (e.g. Orley Farm)
Enter fees:
termly or annual
Automatically:
calculates annualised fees
projects future fees (Y6–Y8) using historical increases
👉 This reflects real-world fee planning, which requires forecasting rising costs
2. 📈 Investment Simulation
Uses real historical return data from funds (e.g. S&P 500 trackers)
Supports multiple fund types:
equities (S&P, FTSE, global)
multi-asset (e.g. 60/40)
cash
👉 Returns are:
pre-stored
source-backed
net of fees where available
3. 💰 Funding Strategy Analysis
The app models:
A. Lump sum funding
“How much capital do I need today?”
B. Drawdown strategy
simulates:
investing capital
withdrawing fees each term
shows:
how the fund evolves over time
4. 📉 Stress Testing
Runs multiple scenarios to test risk:
different return assumptions
bad early market conditions (sequence risk)
Monte Carlo simulations
👉 This aligns with real financial planning tools that model scenarios and uncertainty
5. 📊 Probability of Success
Generates:
probability curve
success rate vs starting capital
👉 Answers:
“What are the chances I won’t run out of money?”
6. 📋 Detailed Outputs
The app produces:
Tables
fees vs investment comparison
cumulative costs
growth vs contributions
term-by-term drawdown
KPIs
total fees
required capital
investment growth
success probabilities
7. ☁️ Data + Collaboration
Stores school fee data locally and in Firestore
Supports:
shared school database
user-specific data
includes:
authentication
audit trail (via revisions model)
🧠 Key Concepts Embedded
The app models real financial principles:
Compounding
Sequence of returns risk
Drawdown strategies (like pensions)
Fee inflation
Scenario modelling
🔥 What Makes It Unique
Unlike typical tools that just:
spread payments
track fees
👉 Feesight:
models investments vs fees
shows opportunity cost
quantifies risk and probability
helps users make capital allocation decisions