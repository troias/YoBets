"use strict";
// Fetches NRL odds for all available AU bookmakers from The Odds API.
// Bet365 AU is not available via this provider — handled by bet365.ts scraper.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TheOddsApiAdapter = void 0;
var API_BASE = "https://api.the-odds-api.com/v4";
var BOOKMAKER_MAP = {
    sportsbet: "sportsbet",
    tab: "tab",
    ladbrokes_au: "ladbrokes",
    neds: "neds",
    pointsbetau: "pointsbet",
    unibet: "unibet",
    betright: "betright",
    betr_au: "betr",
    betfair_ex_au: "betfair",
    tabtouch: "tabtouch",
    playup: "playup",
};
var ALL_BOOKMAKER_KEYS = Object.keys(BOOKMAKER_MAP).join(",");
var MARKET_MAP = {
    h2h: "h2h",
    spreads: "line",
    totals: "total",
};
var DEEP_LINKS = {
    sportsbet: "https://www.sportsbet.com.au/betting/rugby-league",
    tab: "https://www.tab.com.au/sports/betting/Rugby%20League",
    ladbrokes: "https://www.ladbrokes.com.au/sports/rugby-league",
    neds: "https://www.neds.com.au/sports/rugby-league",
    pointsbet: "https://pointsbet.com.au/sports/rugby-league",
    unibet: "https://www.unibet.com.au/betting/sports/rugby-league",
    betright: "https://betright.com.au/sports/rugby-league",
    betr: "https://betr.com.au/sports/rugby-league",
    betfair: "https://www.betfair.com.au/exchange/plus/rugby-league",
    tabtouch: "https://www.tabtouch.com.au/sports/rugby-league",
    playup: "https://www.playup.com.au/sports/rugby-league",
};
var TheOddsApiAdapter = /** @class */ (function () {
    function TheOddsApiAdapter() {
    }
    TheOddsApiAdapter.prototype.fetch = function () {
        return __awaiter(this, void 0, void 0, function () {
            var url, res, _a, _b, _c, remaining, events, rows, _i, events_1, event_1, _d, _e, bookmaker, bk, _f, _g, market, mt, _h, _j, apiOutcome, oc;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        url = new URL("".concat(API_BASE, "/sports/rugbyleague_nrl/odds"));
                        url.searchParams.set("apiKey", process.env.THE_ODDS_API_KEY);
                        url.searchParams.set("regions", "au");
                        url.searchParams.set("markets", "h2h,spreads,totals");
                        url.searchParams.set("bookmakers", ALL_BOOKMAKER_KEYS);
                        url.searchParams.set("oddsFormat", "decimal");
                        return [4 /*yield*/, fetch(url.toString())];
                    case 1:
                        res = _k.sent();
                        if (!!res.ok) return [3 /*break*/, 3];
                        _a = Error.bind;
                        _c = (_b = "The Odds API ".concat(res.status, ": ")).concat;
                        return [4 /*yield*/, res.text()];
                    case 2: throw new (_a.apply(Error, [void 0, _c.apply(_b, [_k.sent()])]))();
                    case 3:
                        remaining = res.headers.get("x-requests-remaining");
                        if (remaining && Number(remaining) < 50) {
                            console.warn("[TheOddsApi] Low quota: ".concat(remaining, " requests remaining"));
                        }
                        return [4 /*yield*/, res.json()];
                    case 4:
                        events = _k.sent();
                        rows = [];
                        for (_i = 0, events_1 = events; _i < events_1.length; _i++) {
                            event_1 = events_1[_i];
                            for (_d = 0, _e = event_1.bookmakers; _d < _e.length; _d++) {
                                bookmaker = _e[_d];
                                bk = BOOKMAKER_MAP[bookmaker.key];
                                if (!bk)
                                    continue;
                                for (_f = 0, _g = bookmaker.markets; _f < _g.length; _f++) {
                                    market = _g[_f];
                                    mt = MARKET_MAP[market.key];
                                    if (!mt)
                                        continue;
                                    for (_h = 0, _j = market.outcomes; _h < _j.length; _h++) {
                                        apiOutcome = _j[_h];
                                        oc = resolveOutcome(apiOutcome.name, event_1.home_team, event_1.away_team);
                                        if (!oc)
                                            continue;
                                        rows.push({
                                            externalEventId: event_1.id,
                                            homeTeam: event_1.home_team,
                                            awayTeam: event_1.away_team,
                                            kickoffAt: new Date(event_1.commence_time),
                                            bookmaker: bk,
                                            marketType: mt,
                                            outcome: oc,
                                            price: apiOutcome.price,
                                            lineValue: apiOutcome.point,
                                            deepLinkUrl: DEEP_LINKS[bk],
                                        });
                                    }
                                }
                            }
                        }
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    return TheOddsApiAdapter;
}());
exports.TheOddsApiAdapter = TheOddsApiAdapter;
function resolveOutcome(name, homeTeam, awayTeam) {
    if (name === homeTeam)
        return "home";
    if (name === awayTeam)
        return "away";
    if (name === "Over")
        return "over";
    if (name === "Under")
        return "under";
    return null;
}
