# EdgeBoard — MVP Product Requirements Document

**Version:** 1.0  
**Target Launch:** 30 days from kickoff  
**Status:** Draft  

---

## 1. Overview

EdgeBoard is a real-time odds comparison platform for Australian sports bettors. The MVP delivers a single-sport, three-bookmaker odds board that surfaces the best available price, arbitrage opportunities, and positive expected value (EV) bets across NRL markets.

---

## 2. Target Market

**Primary user:** Australian sports bettor who actively shops odds across Sportsbet, TAB, and Bet365.  
**Profile:** Places 5–20 NRL bets per week, already has accounts at multiple bookmakers, and understands basic concepts like line shopping and odds value.

---

## 3. MVP Scope

| Dimension | In Scope | Out of Scope |
|---|---|---|
| Sport | NRL only | AFL, A-League, Rugby Union, cricket, etc. |
| Bookmakers | Sportsbet, TAB, Bet365 | Pointsbet, Neds, BlueBet, etc. |
| Markets | Head-to-head (H2H), line (AH), totals (O/U) | Player props, first scorer, exotics |
| Features | Live odds board, best odds, arb finder, EV finder | AI predictions, CLV tracking, steam moves, user portfolios, historical analytics |

---

## 4. Non-Goals

The following are explicitly excluded from the MVP and should not influence architecture or delivery scope:

- AI-generated match predictions
- Closing Line Value (CLV) tracking
- Steam move detection
- User bet portfolios or bet tracking
- Historical odds analytics
- Sports beyond NRL

---

## 5. Features

---

### 5.1 Live Odds Board

**Description:** A real-time table showing current odds for every live and upcoming NRL match across all three bookmakers.

**User Story**  
As an NRL bettor, I want to see live odds from Sportsbet, TAB, and Bet365 side-by-side in a single view so that I can quickly compare prices without switching between three apps.

**Acceptance Criteria**
- [ ] Board displays all NRL matches with kick-off within the next 7 days
- [ ] Each row shows match name, kick-off time, and odds columns for Sportsbet, TAB, and Bet365
- [ ] Markets supported: H2H (Home / Draw / Away), line, totals
- [ ] Odds update within 30 seconds of a change at the source bookmaker
- [ ] Stale odds (>2 min without refresh) are visually flagged (greyed out or timestamped)
- [ ] Board is sorted by kick-off time ascending by default
- [ ] Works on mobile (375px viewport) and desktop
- [ ] Page loads to interactive state in under 3 seconds on a 4G connection

**Required Data**
- Match schedule: teams, kick-off datetime, round, season
- Live odds per market per bookmaker, with last-updated timestamp
- Bookmaker logo / name for column headers

**Success Metric**
- 70% of active sessions include at least one odds board view
- Median odds staleness < 60 seconds during live match windows

---

### 5.2 Best Available Odds

**Description:** For each market on the odds board, highlight the single best price available across all three bookmakers so the user can instantly identify where to bet.

**User Story**  
As an NRL bettor, I want the best available price for each outcome highlighted automatically so that I never accidentally take a worse price than the market offers.

**Acceptance Criteria**
- [ ] The highest odds for each outcome (home, away, draw, line side, total side) are visually highlighted (e.g., bold, green background, or badge)
- [ ] If two bookmakers offer the same best price, both are highlighted
- [ ] Highlighting updates in real-time alongside odds refreshes
- [ ] A "Best Odds" summary card per match shows: outcome label, best price, bookmaker name
- [ ] Clicking / tapping the highlighted cell deep-links to the relevant bookmaker page (affiliate link or direct URL)
- [ ] Best odds are recalculated server-side, not client-side, to prevent stale UI state

**Required Data**
- All data from 5.1
- Deep-link URL template per bookmaker per market type

**Success Metric**
- Bookmaker deep-link click-through rate ≥ 15% of sessions that view a highlighted cell
- Zero reported incidents of incorrect best-odds highlighting in the first 14 days post-launch

---

### 5.3 Arbitrage Opportunity Finder

**Description:** Automatically detect and surface combinations of odds across the three bookmakers where a guaranteed profit can be locked in regardless of match result.

**User Story**  
As an NRL bettor, I want to be alerted when an arbitrage opportunity exists across these bookmakers so that I can place bets that guarantee a return without relying on match outcome.

**Acceptance Criteria**
- [ ] System calculates implied probability sum for each market across all bookmaker combinations
- [ ] Any combination where the implied probability sum < 100% is flagged as an arbitrage opportunity
- [ ] Arb opportunities are displayed in a dedicated "Arbs" section, separate from the main odds board
- [ ] Each arb card shows: match, market, the required bookmaker and odds for each leg, minimum profit percentage (e.g., +1.4%), and a suggested stake split for a $100 total outlay
- [ ] Cards are sorted by profit percentage descending
- [ ] A new arb opportunity triggers an in-app notification (toast) if the user is on the platform
- [ ] Opportunities that close (implied prob returns above 100%) are removed within 60 seconds
- [ ] Arb % and stake split recalculate on each odds refresh

**Required Data**
- All data from 5.1
- Bookmaker-specific minimum bet limits (to flag opportunities below the minimum viable stake — display only, no enforcement)

**Success Metric**
- At least 1 arb opportunity surfaced per NRL match day during the first 4 weeks
- Arb card-to-click conversion ≥ 20% (user taps a bookmaker link from an arb card)

---

### 5.4 Positive EV Opportunity Finder

**Description:** Identify bets where the implied probability derived from the sharpest available market (no-vig fair odds) suggests the offered price from one bookmaker represents positive expected value.

**User Story**  
As an NRL bettor, I want to see which individual bets across the board have positive expected value so that I can make bets that are profitable in the long run, even when no arb exists.

**Acceptance Criteria**
- [ ] Fair (no-vig) probability for each outcome is derived from the sharpest available line using the Pinnacle method or equivalent (remove bookmaker margin from best available market price)
- [ ] EV % is calculated as: `EV% = (fair_probability × decimal_odds) - 1`
- [ ] Any outcome with EV% > 0% is flagged as a positive EV bet
- [ ] Positive EV bets appear in a dedicated "EV Bets" section
- [ ] Each EV card shows: match, market, outcome, bookmaker, offered odds, fair odds, EV%, and a plain-English label (e.g., "Sydney Roosters H2H at Sportsbet — +3.2% EV")
- [ ] Cards are sorted by EV% descending
- [ ] EV threshold is configurable in a simple filter (e.g., "Show only EV > 2%") with a default of > 0%
- [ ] EV cards update within 60 seconds of an odds change that affects the calculation
- [ ] A tooltip or info icon explains EV in plain language for less experienced users

**Required Data**
- All data from 5.1
- No-vig fair probability model (derived from live odds, no external model required at MVP)

**Success Metric**
- EV section has a ≥ 10% click-through rate to bookmaker links
- User sessions that visit the EV section stay on-site at least 2x longer than sessions that do not (engagement proxy for perceived value)

---

## 6. Technical Constraints

| Constraint | Detail |
|---|---|
| Odds freshness | Target ≤ 30-second update cycle for in-play matches; ≤ 2-minute cycle for pre-match |
| Bookmaker data | Data must be obtained via official API partnerships or public-facing scraping where permitted under bookmaker ToS |
| Geo-restriction | Platform must be accessible only from Australian IP addresses (legal requirement) |
| Responsible gambling | Each page must display a responsible gambling notice and link to GambleAware |
| HTTPS | All connections TLS 1.2+ |

---

## 7. Out-of-Scope Deferral Table

| Feature | Reason Deferred | Earliest Revisit |
|---|---|---|
| AI match predictions | Requires training data and model infrastructure beyond 30-day window | Post-MVP v1 |
| CLV tracking | Needs user accounts and bet-logging infrastructure | Post-MVP v1 |
| Steam move detection | Requires historical odds velocity data not available at launch | v2 |
| User portfolios | Account system not in MVP scope | Post-MVP v1 |
| Historical analytics | No data warehouse at MVP | v2 |
| Additional sports | Focused NRL launch reduces integration complexity | Post-MVP v1 |

---

## 8. Success Criteria (MVP Exit)

The MVP is considered successful and ready for v1 development when the following are met after 14 days of live operation:

| Metric | Target |
|---|---|
| Odds board uptime | ≥ 99% during NRL match windows |
| Median odds staleness | < 60 seconds |
| Arb opportunities per match day | ≥ 1 |
| Bookmaker link CTR from best odds | ≥ 15% |
| EV section engagement (session length 2x) | Confirmed in analytics |
| User-reported data accuracy issues | 0 critical bugs in 14 days |

---

## 9. Launch Checklist (30-Day Timeline)

| Week | Milestone |
|---|---|
| Week 1 | Bookmaker odds ingestion live for all three; match schedule seeded |
| Week 2 | Live odds board rendering on web; best odds highlighting working |
| Week 3 | Arb finder logic complete and validated; EV finder complete |
| Week 4 | Geo-restriction, responsible gambling notices, QA pass, soft launch |

---

*Document owner: Troy Flavell — EdgeBoard*  
*Last updated: 2026-06-20*
