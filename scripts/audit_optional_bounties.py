"""Independent source replay for optional-entry bounty results.

Shares only decoding and explicit schedule resolution with intake, not its ledger
or reconciliation implementation. Checks every output against a fresh raw replay.
"""
from collections import Counter, defaultdict
from decimal import Decimal
from hashlib import sha256
from optional_bounties import history_actions, regular_prizes, stamp


def normalized(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: normalized(v) for k, v in value.items()}
    if isinstance(value, list):
        return [normalized(v) for v in value]
    return value


def audit_optional_event(audit, event, raw_path, rule, metadata, source_helpers):
    event_id = event['eventId']
    def check(ok, message):
        audit.check(ok, 'optionalBounties', f'{event_id}: {message}')
    try:
        _audit(event, raw_path, rule, metadata, source_helpers, check)
    except (RuntimeError, ValueError, KeyError, TypeError, OSError) as exc:
        check(False, 'source replay failed: ' + str(exc))


def _audit(event, raw_path, rule, metadata, helper, check):
    # Decode both sources independently of the production reconciliation output.
    html = raw_path.read_text(encoding='utf-8')
    alias_map = helper.build_alias_map(metadata)
    raw_actions = [helper.parse_action_line(line, alias_map) for line in helper.extract_action_lines(html)]
    detailed_path = raw_path.parent / rule['detailedHistoryFile']
    detail, winners = history_actions(detailed_path, alias_map, helper.canonicalize_player_name, rule)
    recipient = rule.get('rolloverRecipient', winners[0] if len(winners) == 1 else None)
    check(recipient in winners, 'unconfirmed chop rollover recipient')
    if len(winners) > 1:
        # The summary emits artificial uncredited busts when ending a chop.
        # Only terminal, uncredited finalist actions may be removed.
        ending = stamp(detail[-1]['time_raw'])
        raw_actions = [a for a in raw_actions if not (a['type'] == 'bustout' and not a.get('bySlug')
                       and a.get('slug') in winners and stamp(a['time_raw']) == ending)]
    relevant = {'buyin', 'rebuy', 'bustout', 'tournament_started', 'tournament_ended'}
    sig = lambda a: (a['type'], stamp(a['time_raw']), a.get('slug'), a.get('bySlug'))
    check(Counter(sig(a) for a in raw_actions if a['type'] in relevant) == Counter(sig(a) for a in detail), 'paired source action mismatch')
    check(Counter(sig(a) for a in event['actions'] if a['type'] in relevant) == Counter(sig(a) for a in detail), 'published action differs from sources')
    check(not any(a['type'] == 'unparsed' for a in raw_actions), 'unparsed summary action')
    receipts = [a for a in raw_actions if a['type'] == 'payout']
    check([a for a in event['actions'] if a['type'] == 'payout'] == receipts, 'original receipts were modified')
    fee, amount = Decimal(str(rule['entryAmount'])), Decimal(str(rule['bounty']['amount']))
    state, counts, totals, exits, claims = {}, Counter(), defaultdict(Counter), [], []
    expected_entries = []
    rollover = Decimal(0)
    reloads = {(r['slug'], r['time']) for r in rule.get('reloads', [])}
    used_reloads = set()
    for a in detail:
        slug = a.get('slug')
        if a['type'] in ('buyin', 'rebuy'):
            is_reload = (slug, stamp(a['time_raw'])) in reloads
            check(slug not in state or is_reload, 'duplicate active entry')
            check((counts[slug] == 0) == (a['type'] == 'buyin'), 'entry kind mismatch')
            counts[slug] += 1
            if is_reload:
                check(slug in state and a['type'] == 'rebuy' and a['bountyPosted'] == 0, 'invalid reload')
                used_reloads.add((slug, stamp(a['time_raw'])))
            else:
                state[slug] = (counts[slug], Decimal(str(a['bountyPosted'])))
            check(a['entryFee'] == fee and a['bountyPosted'] in (0, amount), 'invalid entry amount')
            check(a['type'] != 'buyin' or a['bountyPosted'] == amount, 'missing initial bounty')
            totals[slug]['buyIns' if a['type'] == 'buyin' else 'rebuys'] += 1
            totals[slug]['bountyPaid'] += Decimal(str(a['bountyPosted']))
            expected_entries.append((sig(a), counts[slug], a['bountyPosted'], a['entryFee'],
                                     is_reload, state[slug][0] if is_reload else None))
        elif a['type'] == 'bustout':
            killer = a['bySlug']
            check(slug != killer and slug in state and killer in state, 'inactive knockout participant')
            victim_n, victim_bounty = state.pop(slug)
            killer_n, killer_bounty = state[killer]
            totals[killer]['hits'] += 1
            exits.append(slug)
            disposition = 'none'
            if victim_bounty:
                if killer_bounty:
                    disposition = 'collected'
                    totals[killer]['bountiesWon'] += 1
                    totals[killer]['bountyCollected'] += victim_bounty
                else:
                    disposition = 'winner_rollover'
                    rollover += victim_bounty
            claims.append(dict(killer=killer, victim=slug, victimEntry=victim_n, killerEntry=killer_n,
                               time=stamp(a['time_raw']), amount=victim_bounty, disposition=disposition))
    check(used_reloads == reloads, 'configured reload missing')
    check(set(state) == set(winners), 'survivors differ from winners')
    published_entries = [(sig(a), a.get('entryOrdinal'), a.get('bountyPosted'), a.get('entryFee'),
                          a.get('isReload', False), a.get('activeEntryOrdinal'))
                         for a in event['actions'] if a['type'] in ('buyin', 'rebuy')]
    check(Counter(published_entries) == Counter(expected_entries), 'published entry choices/ordinals differ from raw history')
    for winner in winners:
        totals[winner]['bountyRetained'] = state[winner][1]
    totals[recipient]['rolloverPrize'] = rollover
    base = Decimal(str(helper.extract_total_pot(html)))
    paid_spots = helper.extract_paid_spots(html)
    prizes = regular_prizes(rule, receipts, set(totals), base, paid_spots)
    check(sum(counts.values()) * fee == base, 'regular pool differs from entries')
    published_rows = {r['slug']: r for r in event['players']}
    check(set(published_rows) == {p['slug'] for p in metadata} and len(published_rows) == len(event['players']), 'player row set mismatch')
    cashers = {s for s, p in prizes.items() if p > 0} | ({recipient} if rollover else set())
    # Last permanent noncash exit, accounting for later reentries.
    final_exits = [s for s in exits if s not in cashers and s not in state]
    bubble = final_exits[-1] if final_exits else None
    for slug, row in published_rows.items():
        t = totals[slug]
        t['entries'] = counts[slug]
        t['timesPlaced'] = int(slug in cashers)
        t['bubbles'] = int(slug == bubble)
        t['regularPrize'] = prizes.get(slug, Decimal(0))
        t['bountyWinnings'] = t['bountyCollected'] + t['bountyRetained']
        t['bountyNet'] = t['bountyWinnings'] - t['bountyPaid']
        t['tournamentCost'] = counts[slug] * fee
        t['tournamentWinnings'] = t['regularPrize'] + t['rolloverPrize']
        t['tournamentProfit'] = t['tournamentWinnings'] - t['tournamentCost']
        t['totalCost'] = t['tournamentCost'] + t['bountyPaid']
        t['settlementAdjustment'] = Decimal(str(rule.get('settlementAdjustmentsByPlayer', {}).get(slug, {}).get('amount', 0)))
        t['totalWinnings'] = t['tournamentWinnings'] + t['bountyWinnings'] + t['settlementAdjustment']
        t['profit'] = t['totalWinnings'] - t['totalCost']
        for key in ('buyIns', 'rebuys', 'entries', 'hits', 'timesPlaced', 'bubbles', 'bountiesWon',
                    'bountyPaid', 'bountyCollected', 'bountyRetained', 'bountyWinnings', 'bountyNet',
                    'regularPrize', 'rolloverPrize', 'tournamentCost', 'tournamentWinnings',
                    'tournamentProfit', 'totalCost', 'totalWinnings', 'profit', 'settlementAdjustment'):
            check(Decimal(str(row.get(key, 0))) == t[key], f'{slug}/{key} differs from independent entry replay')
    take = sum(t['bountyPaid'] for t in totals.values())
    collected = sum(t['bountyCollected'] for t in totals.values())
    retained = sum(t['bountyRetained'] for t in totals.values())
    summary = event['summary']
    check(summary['regularPrizePool'] == base and summary['totalPot'] == base + rollover, 'prize pool/rollover mismatch')
    check(summary['entries'] == sum(counts.values()) and summary['buyIns'] == len(counts)
          and summary['rebuys'] == sum(counts.values()) - len(counts), 'entry summary mismatch')
    check(summary['paidSpots'] == paid_spots == len(cashers), 'paid places mismatch')
    for label, key in [('Buy-ins:', 'buyIns'), ('Rebuys:', 'rebuys')]:
        check(helper.extract_takein_count(html, label) == summary[key], 'raw entry count differs from summary')
        check(helper.extract_takein_total(html, label) == summary[key] * fee, 'raw entry fee total differs from summary')
    for kind, field in [('tournament_started', 'startTimeRaw'), ('tournament_ended', 'endTimeRaw')]:
        check([stamp(a['time_raw']) for a in detail if a['type'] == kind] == [stamp(summary[field])], 'boundary timestamp mismatch')
    check(summary['startTimeIso'].split('T')[0] == event['date'] == event['eventId'], 'event date mismatch')
    expected_summary = dict(amount=amount, pool=take, collected=collected, retained=retained,
                            rollover=rollover, bountiesBought=take/amount, bountiesWon=collected/amount,
                            bountiesRetained=retained/amount, firstEntryOnly=False, retainIfUnbusted=True,
                            winnerOnlyRollover=True, mode='optional-rebuy')
    check(summary['bounty'] == expected_summary, 'bounty summary (including Kept/rollover classification) mismatch')
    for key, expected in [('Bought:', take), ('Won:', collected), ('Kept:', retained+rollover)]:
        raw = helper.extract_table_money_count(html, 'Bounties', key)
        check(raw['amount'] == expected and raw['count'] * amount == expected, 'raw bounty aggregate mismatch: '+key)
    check(take == collected + retained + rollover, 'bounty conservation failed')
    check(sum(Decimal(str(r['payout'])) for r in receipts) == base + take, 'source receipts do not balance')
    settlement_total = sum(t['settlementAdjustment'] for t in totals.values())
    check(sum(t['profit'] for t in totals.values()) == settlement_total, 'corrected receipts do not balance with confirmed settlement')
    if settlement_total:
        settlement = summary.get('settlement', {})
        check(settlement.get('adjustment') == settlement_total and settlement.get('cashCollected') == base + take
              and settlement.get('cashPaid') == base + take + settlement_total, 'settlement summary mismatch')
    for slug, amount_paid in rule.get('actualReceiptsByPlayer', {}).items():
        check(totals[slug]['totalWinnings'] == amount_paid, 'actual payout differs from host confirmation')
    expected_winners = [dict(name=r['player'], slug=r['slug'], rank=r['rank'],
                            payout=totals[r['slug']]['tournamentWinnings']) for r in receipts if r['slug'] in cashers]
    check(event['winners'] == normalized(expected_winners), 'winner-only tournament payout mismatch')
    ledger = event['bountyAccounting']
    check(ledger['claims'] == claims, 'entry-qualified claim ledger mismatch')
    check(ledger['historyFile'] == rule['detailedHistoryFile'] and ledger['historySha256'] == sha256(detailed_path.read_bytes()).hexdigest(), 'history source fingerprint mismatch')
    actual_busts = [a for a in event['actions'] if a['type'] == 'bustout']
    for a, c in zip(actual_busts, claims):
        check((a.get('bountyDisposition'), a.get('bountyAmount'), a.get('victimEntry'), a.get('killerEntry')) ==
              (c['disposition'], c['amount'], c['victimEntry'], c['killerEntry']), 'knockout bounty annotation mismatch')
    expected_reconciliation = []
    missing = sorted(set(prizes) - {r['slug'] for r in receipts})
    check(not missing or rule.get('allowOmittedZeroReceipts') is True, 'missing explicit receipts')
    for slug in missing:
        check(totals[slug]['totalWinnings'] == 0, 'omitted receipt has earnings')
    for r in receipts + [dict(slug=s, payout=0) for s in missing]:
        t = totals[r['slug']]
        extra = Decimal(str(r['payout'])) - t['regularPrize'] - t['bountyWinnings']
        source_extra = rule.get('sourceRolloverAllocationsByPlayer', {}).get(r['slug'])
        check(extra >= 0 and (t['regularPrize'] > 0 or extra == 0 or extra == source_extra), 'invalid exported rollover allocation')
        if source_extra is not None:
            check(extra == source_extra, 'source rollover mismatch')
        expected_reconciliation.append(dict(slug=r['slug'], reportedReceipt=r['payout'], regularPrize=t['regularPrize'],
            exportedRolloverAllocation=extra, rolloverPrize=t['rolloverPrize'], correctedReceipt=t['totalWinnings'],
            adjustment=t['totalWinnings']-Decimal(str(r['payout']))))
        if t['settlementAdjustment']:
            expected_reconciliation[-1].update(settlementAdjustment=t['settlementAdjustment'],
                settlementReason=rule['settlementAdjustmentsByPlayer'][r['slug']]['reason'])
    check(ledger['reconciliation'] == normalized(expected_reconciliation), 'receipt reconciliation mismatch')
    check(sum(r['exportedRolloverAllocation'] for r in expected_reconciliation) == rollover,
          'source rollover allocations do not reconcile')
