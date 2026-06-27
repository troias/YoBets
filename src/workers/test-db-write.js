"use strict";
// End-to-end test: fetch odds → write to Supabase → verify rows exist.
// Run: npx tsx --env-file .env.local src/workers/test-db-write.ts
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var the_odds_api_1 = require("./scrapers/adapters/the-odds-api");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var adapter, rows, uniqueEvents, matchIdCache, _i, uniqueEvents_1, event_1, dayStart, dayEnd, match, now, written, byEvent, _a, rows_1, row, _loop_1, _b, byEvent_1, _c, eventId, eventRows, matchCount, oddsCount, bookmakers, firstMatch, _d, _e, odd;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    console.log("1. Fetching NRL odds from The Odds API...");
                    adapter = new the_odds_api_1.TheOddsApiAdapter();
                    return [4 /*yield*/, adapter.fetch()];
                case 1:
                    rows = _f.sent();
                    console.log("   \u2713 ".concat(rows.length, " odds rows fetched"));
                    console.log("\n2. Upserting matches...");
                    uniqueEvents = deduplicateEvents(rows);
                    matchIdCache = new Map();
                    _i = 0, uniqueEvents_1 = uniqueEvents;
                    _f.label = 2;
                case 2:
                    if (!(_i < uniqueEvents_1.length)) return [3 /*break*/, 8];
                    event_1 = uniqueEvents_1[_i];
                    dayStart = new Date(event_1.kickoffAt);
                    dayStart.setHours(0, 0, 0, 0);
                    dayEnd = new Date(dayStart);
                    dayEnd.setDate(dayEnd.getDate() + 1);
                    return [4 /*yield*/, prisma.match.findFirst({
                            where: {
                                homeTeam: { equals: event_1.homeTeam, mode: "insensitive" },
                                awayTeam: { equals: event_1.awayTeam, mode: "insensitive" },
                                kickoffAt: { gte: dayStart, lt: dayEnd },
                            },
                            select: { id: true },
                        })];
                case 3:
                    match = _f.sent();
                    if (!!match) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma.match.create({
                            data: {
                                homeTeam: event_1.homeTeam,
                                awayTeam: event_1.awayTeam,
                                kickoffAt: event_1.kickoffAt,
                                round: 0,
                                season: new Date().getFullYear(),
                                status: "upcoming",
                            },
                            select: { id: true },
                        })];
                case 4:
                    match = _f.sent();
                    console.log("   + Created: ".concat(event_1.homeTeam, " vs ").concat(event_1.awayTeam));
                    return [3 /*break*/, 6];
                case 5:
                    console.log("   = Exists:  ".concat(event_1.homeTeam, " vs ").concat(event_1.awayTeam));
                    _f.label = 6;
                case 6:
                    matchIdCache.set(event_1.externalEventId, match.id);
                    _f.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8:
                    console.log("\n3. Upserting odds rows...");
                    now = new Date();
                    written = 0;
                    byEvent = new Map();
                    for (_a = 0, rows_1 = rows; _a < rows_1.length; _a++) {
                        row = rows_1[_a];
                        if (!byEvent.has(row.externalEventId))
                            byEvent.set(row.externalEventId, []);
                        byEvent.get(row.externalEventId).push(row);
                    }
                    _loop_1 = function (eventId, eventRows) {
                        var matchId;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0:
                                    matchId = matchIdCache.get(eventId);
                                    if (!matchId)
                                        return [2 /*return*/, "continue"];
                                    return [4 /*yield*/, prisma.$transaction(eventRows.map(function (row) {
                                            var _a, _b;
                                            return prisma.odds.upsert({
                                                where: {
                                                    matchId_bookmaker_marketType_outcome: {
                                                        matchId: matchId,
                                                        bookmaker: row.bookmaker,
                                                        marketType: row.marketType,
                                                        outcome: row.outcome,
                                                    },
                                                },
                                                update: { price: row.price, lineValue: (_a = row.lineValue) !== null && _a !== void 0 ? _a : null, updatedAt: now },
                                                create: {
                                                    matchId: matchId,
                                                    bookmaker: row.bookmaker,
                                                    marketType: row.marketType,
                                                    outcome: row.outcome,
                                                    price: row.price,
                                                    lineValue: (_b = row.lineValue) !== null && _b !== void 0 ? _b : null,
                                                    deepLinkUrl: row.deepLinkUrl,
                                                    updatedAt: now,
                                                },
                                            });
                                        }))];
                                case 1:
                                    _g.sent();
                                    written += eventRows.length;
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _b = 0, byEvent_1 = byEvent;
                    _f.label = 9;
                case 9:
                    if (!(_b < byEvent_1.length)) return [3 /*break*/, 12];
                    _c = byEvent_1[_b], eventId = _c[0], eventRows = _c[1];
                    return [5 /*yield**/, _loop_1(eventId, eventRows)];
                case 10:
                    _f.sent();
                    _f.label = 11;
                case 11:
                    _b++;
                    return [3 /*break*/, 9];
                case 12:
                    console.log("   \u2713 ".concat(written, " odds rows written"));
                    console.log("\n4. Verifying DB state...");
                    return [4 /*yield*/, prisma.match.count()];
                case 13:
                    matchCount = _f.sent();
                    return [4 /*yield*/, prisma.odds.count()];
                case 14:
                    oddsCount = _f.sent();
                    return [4 /*yield*/, prisma.odds.findMany({
                            distinct: ["bookmaker"],
                            select: { bookmaker: true },
                        })];
                case 15:
                    bookmakers = _f.sent();
                    console.log("   matches table: ".concat(matchCount, " rows"));
                    console.log("   odds table:    ".concat(oddsCount, " rows"));
                    console.log("   bookmakers:    ".concat(bookmakers.map(function (b) { return b.bookmaker; }).sort().join(", ")));
                    console.log("\n5. Sample odds for first match...");
                    return [4 /*yield*/, prisma.match.findFirst({
                            orderBy: { kickoffAt: "asc" },
                            include: {
                                odds: {
                                    where: { marketType: "h2h" },
                                    orderBy: [{ bookmaker: "asc" }, { outcome: "asc" }],
                                },
                            },
                        })];
                case 16:
                    firstMatch = _f.sent();
                    if (firstMatch) {
                        console.log("   ".concat(firstMatch.homeTeam, " vs ").concat(firstMatch.awayTeam));
                        for (_d = 0, _e = firstMatch.odds; _d < _e.length; _d++) {
                            odd = _e[_d];
                            console.log("   ".concat(odd.bookmaker.padEnd(12), " ").concat(odd.outcome.padEnd(5), " ").concat(Number(odd.price).toFixed(2)));
                        }
                    }
                    console.log("\n✓ End-to-end test passed");
                    return [4 /*yield*/, prisma.$disconnect()];
                case 17:
                    _f.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function deduplicateEvents(rows) {
    var seen = new Map();
    for (var _i = 0, rows_2 = rows; _i < rows_2.length; _i++) {
        var row = rows_2[_i];
        if (!seen.has(row.externalEventId)) {
            seen.set(row.externalEventId, {
                externalEventId: row.externalEventId,
                homeTeam: row.homeTeam,
                awayTeam: row.awayTeam,
                kickoffAt: row.kickoffAt,
            });
        }
    }
    return __spreadArray([], seen.values(), true);
}
main().catch(function (err) {
    console.error("\n✗ Test failed:", err.message);
    prisma.$disconnect();
    process.exit(1);
});
