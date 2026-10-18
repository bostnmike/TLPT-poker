"""Strict paired-export accounting for explicitly configured optional rebuy bounties.

No defaults select this mode. Money is calculated in Decimal and exported in cents.
The summary's Kept includes forfeitures; only an active entry can retain its bounty.
"""
import re
from collections import Counter
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from hashlib import sha256
from pathlib import Path


def require(condition, message):
    if not condition:
        raise RuntimeError("Optional bounties: " + message)


def money(value):
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise RuntimeError("Optional bounties: invalid money") from exc
    require(result.is_finite() and result >= 0 and result == result.quantize(Decimal('.01')),
            "money must be nonnegative exact cents")
    return result


def number(value):
    return int(value) if value == int(value) else float(value)


def stamp(value):
    try:
        return datetime.strptime(value.upper(), '%I:%M:%S %p %m/%d/%Y').isoformat()
    except ValueError as exc:
        raise RuntimeError('Optional bounties: invalid history timestamp') from exc


def history_actions(path, alias_map, canonicalize):
    require(path.is_file(), 'MISSING_HISTORY: paired detailed history is required')
    actions, declared_winners = [], []
    previous = ''
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if not line.strip():
            continue
        match = re.fullmatch(r'(\d{1,2}:\d{2}:\d{2} [ap]m \d{2}/\d{2}/\d{4}): (.+)', line.strip(), re.I)
        require(match, 'unrecognized detailed history line')
        time, body = match.groups()
        current = stamp(time)
        require(current >= previous, 'history is not chronological')
        previous = current
        action = {'time_raw': time}
        entry = re.fullmatch(r'(.+?) (bought-in|rebought into tournament) \((.+)\)', body)
        bust = re.fullmatch(r'(.+?) busted out of the tournament \([^)]*\) by (.+?) \([^)]*\)', body)
        win = re.fullmatch(r'(.+?) won the tournament', body)
        if entry:
            name, kind, details = entry.groups()
            name, slug = canonicalize(name, alias_map)
            fee = re.findall(r'(?:^|, )Fee: \$([\d,.]+)(?=,|$)', details)
            rake = re.findall(r'(?:^|, )Rake: \$([\d,.]+)(?=,|$)', details)
            bounty = re.findall(r'(?:^|, )Bounty Chip: \$([\d,.]+)(?=,|$)', details)
            require(len(fee) == len(rake) == 1 and len(bounty) <= 1, 'ambiguous entry money')
            require('Bounty Chip:' not in details or len(bounty) == 1, 'invalid bounty choice')
            action.update(type='buyin' if kind == 'bought-in' else 'rebuy', player=name, slug=slug,
                          entryFee=number(money(fee[0].replace(',', ''))),
                          bountyPosted=number(money(bounty[0].replace(',', ''))) if bounty else 0)
            require(money(rake[0].replace(',', '')) == 0, 'nonzero rake needs a separate supported policy')
        elif bust:
            name, slug = canonicalize(bust[1], alias_map)
            killer, killer_slug = canonicalize(bust[2], alias_map)
            action.update(type='bustout', player=name, slug=slug, by=killer, bySlug=killer_slug)
        elif win:
            declared_winners.append((canonicalize(win[1], alias_map)[1], current))
            continue
        elif body in ('Tournament started', 'Tournament ended'):
            action['type'] = 'tournament_started' if body.endswith('started') else 'tournament_ended'
        elif re.fullmatch(r'[^:]+, Seat \d+: .+', body):
            continue  # Seating is not a financial action.
        else:
            raise RuntimeError('Optional bounties: unsupported history action: ' + body)
        actions.append(action)
    require(len(declared_winners) == 1, 'one explicit winner is required; ambiguous chops need review')
    require(actions and actions[-1]['type'] == 'tournament_ended'
            and stamp(actions[-1]['time_raw']) == declared_winners[0][1], 'winner declaration must match tournament end')
    return actions, declared_winners[0][0]


def regular_prizes(config, receipts, entrants, pool, paid_spots):
    exact = config.get('regularPayoutsByPlayer')
    percentages = config.get('regularPayoutPercentages')
    require(bool(exact) != bool(percentages), 'MISSING_PRIZES: supply exact regular prizes OR an explicit percentage schedule')
    require(not config.get('tournamentPayouts') and not config.get('tournamentPayoutsByPlayer'),
            'optional mode requires explicitly pre-bounty regular prizes')
    if exact:
        require(not config.get('regularPayoutFixed'), 'exact prizes already include fixed awards')
        require(set(exact) == entrants, 'regular prize schedule must include every entrant (zero for noncashers)')
        prizes = {slug: money(value) for slug, value in exact.items()}
    else:
        ranks = [row['rank'] for row in receipts]
        require(len(ranks) == len(set(ranks)), 'chops require exact regular prizes')
        shares = {int(rank): Decimal(str(value)) for rank, value in percentages.items()}
        fixed = {int(rank): money(value) for rank, value in (config.get('regularPayoutFixed') or {}).items()}
        require(all(v.is_finite() and v > 0 for v in shares.values()) and sum(shares.values()) == 100,
                'percentages must be positive and total 100')
        require(set(shares) <= set(ranks), 'percentage rank is absent from receipts')
        require(set(fixed) <= set(ranks) and not set(fixed) & set(shares), 'fixed ranks must be present and separate from percentage ranks')
        remaining_pool = pool - sum(fixed.values())
        require(remaining_pool > 0, 'fixed awards exhaust the regular prize pool')
        prizes = {slug: Decimal(0) for slug in entrants}
        for row in receipts:
            prizes[row['slug']] = fixed.get(row['rank'],
                (remaining_pool * shares.get(row['rank'], 0) / 100).quantize(Decimal('.01'), rounding=ROUND_DOWN))
        remainder = pool - sum(prizes.values())
        if remainder:
            rank = config.get('centRemainderRank')
            require(rank in shares, 'fractional cents require an explicit centRemainderRank')
            recipient = next(row['slug'] for row in receipts if row['rank'] == rank)
            prizes[recipient] += remainder
    require(sum(prizes.values()) == pool, 'regular prizes must equal the regular entry pool')
    require(sum(v > 0 for v in prizes.values()) == paid_spots, 'regular prizes disagree with paid places')
    return prizes


def reconcile(path, config, actions, receipts, bounty_table, pool, paid_spots,
              entry_amount, bounty_amount, alias_map, canonicalize, summary_start, summary_end,
              buyins, rebuys, winner_text):
    """Return corrected tournament payouts, bounty ledger and annotated actions."""
    filename = config.get('detailedHistoryFile')
    require(isinstance(filename, str) and filename and Path(filename).name == filename,
            'MISSING_HISTORY: use a paired history filename in the summary directory')
    history = path.parent / filename
    detail, winner = history_actions(history, alias_map, canonicalize)
    require(canonicalize(winner_text, alias_map)[1] == winner, 'PAIR_MISMATCH: summary winner differs')
    def signature(action):
        return (action['type'], stamp(action['time_raw']), action.get('slug'), action.get('bySlug'))
    relevant = {'buyin', 'rebuy', 'bustout', 'tournament_started', 'tournament_ended'}
    require(all(a['type'] in relevant | {'payout', 'total_pot'} for a in actions),
            'unsupported or ambiguous summary action')
    require([signature(a) for a in actions if a['type'] in relevant] == [signature(a) for a in detail],
            'PAIR_MISMATCH: summary and history actions differ')
    for kind, value in [('tournament_started', summary_start), ('tournament_ended', summary_end)]:
        require([stamp(a['time_raw']) for a in detail if a['type'] == kind] == [stamp(value)],
                'PAIR_MISMATCH: tournament boundaries differ')
    require(all(stamp(r['time_raw']) == stamp(summary_end) for r in receipts), 'receipt timestamp differs from event end')
    require([money(a['totalPot']) for a in actions if a['type'] == 'total_pot'] == [money(pool)], 'regular pool action mismatch')
    active, ordinal, values = {}, Counter(), {}
    claims = []
    amount, fee, base = money(bounty_amount), money(entry_amount), money(pool)
    for a in detail:
        kind, slug = a['type'], a.get('slug')
        if kind in ('buyin', 'rebuy'):
            require(slug not in active, 'ENTRY_WHILE_ACTIVE: entry before bustout')
            require((kind == 'buyin') == (ordinal[slug] == 0), 'invalid entry ordinal')
            posted = money(a['bountyPosted'])
            require(money(a['entryFee']) == fee and posted in (0, amount), 'entry fee or bounty amount mismatch')
            require(kind != 'buyin' or posted == amount, 'initial entry must post a bounty')
            ordinal[slug] += 1
            a['entryOrdinal'] = ordinal[slug]
            active[slug] = a
            v = values.setdefault(slug, dict(bountyPaid=Decimal(0), bountyCollected=Decimal(0),
                                            bountyRetained=Decimal(0), bountiesWon=0, rolloverPrize=Decimal(0)))
            v['bountyPaid'] += posted
        elif kind == 'bustout':
            killer = a['bySlug']
            require(slug in active and killer in active and slug != killer, 'knockout requires two active distinct entries')
            victim_entry, killer_entry = active.pop(slug), active[killer]
            posted = money(victim_entry['bountyPosted'])
            disposition = 'none' if not posted else ('collected' if killer_entry['bountyPosted'] else 'winner_rollover')
            a.update(victimEntry=victim_entry['entryOrdinal'], killerEntry=killer_entry['entryOrdinal'],
                     bountyDisposition=disposition, bountyAmount=number(posted))
            claims.append(dict(killer=killer, victim=slug, killerEntry=a['killerEntry'], victimEntry=a['victimEntry'],
                               time=stamp(a['time_raw']), amount=number(posted), disposition=disposition))
            if disposition == 'collected':
                values[killer]['bountyCollected'] += posted
                values[killer]['bountiesWon'] += 1
    require(set(active) == {winner}, 'winner must be the sole surviving entry; ambiguous chops need review')
    require(sum(a['type'] == 'buyin' for a in detail) == buyins and sum(a['type'] == 'rebuy' for a in detail) == rebuys,
            'summary entry counts disagree with history')
    require(base == (buyins + rebuys) * fee, 'regular entry pool mismatch')
    values[winner]['bountyRetained'] = money(active[winner]['bountyPosted'])
    rollover = sum((money(c['amount']) for c in claims if c['disposition'] == 'winner_rollover'), Decimal(0))
    values[winner]['rolloverPrize'] = rollover
    paid = sum(v['bountyPaid'] for v in values.values())
    collected = sum(v['bountyCollected'] for v in values.values())
    retained = sum(v['bountyRetained'] for v in values.values())
    require(paid == collected + retained + rollover, 'bounty conservation failed')
    for key, expected in [('bought', paid), ('won', collected), ('kept', retained + rollover)]:
        require(money(bounty_table[key]['amount']) == expected and bounty_table[key]['count'] * amount == expected,
                'SUMMARY_BOUNTY_MISMATCH: ' + key + ' includes personal retention plus forfeitures only for Kept')
    require(len(receipts) == len({r['slug'] for r in receipts}) and {r['slug'] for r in receipts} == set(values),
            'one explicit receipt (including zero) required for each entrant')
    require([r['slug'] for r in receipts if r['rank'] == 1] == [winner], 'receipt winner differs from detailed history')
    prizes = regular_prizes(config, receipts, set(values), base, paid_spots)
    require(sum(money(r['payout']) for r in receipts) == base + paid, 'RECEIPT_MISMATCH: source receipts do not conserve all money')
    adjusted, reconciliation = [], []
    for r in receipts:
        slug, v = r['slug'], values[r['slug']]
        gross = v['bountyCollected'] + v['bountyRetained']
        exported_extra = money(r['payout']) - prizes[slug] - gross
        require(exported_extra >= 0 and (prizes[slug] > 0 or exported_extra == 0), 'source receipt cannot be reconciled to regular prizes and verified bounties')
        corrected = prizes[slug] + v['rolloverPrize'] + gross
        reconciliation.append(dict(slug=slug, reportedReceipt=r['payout'], regularPrize=number(prizes[slug]),
                                   exportedRolloverAllocation=number(exported_extra), rolloverPrize=number(v['rolloverPrize']),
                                   correctedReceipt=number(corrected), adjustment=number(corrected-money(r['payout']))))
        if prizes[slug] or v['rolloverPrize']:
            adjusted.append({**r, 'payout': number(prizes[slug] + v['rolloverPrize'])})
        v['regularPrize'] = prizes[slug]
        v['bountyWinnings'] = gross
        for key, value in v.items():
            v[key] = number(value)
    require(sum(money(r['exportedRolloverAllocation']) for r in reconciliation) == rollover,
            'exported rollover allocations do not reconcile')
    ledger = dict(amount=number(amount), bought=bounty_table['bought'], won=bounty_table['won'],
                  kept={'amount': number(retained), 'count': int(retained / amount)}, players=values,
                  rollover=number(rollover), claims=claims, reconciliation=reconciliation,
                  historyFile=filename, historySha256=sha256(history.read_bytes()).hexdigest())
    annotated = iter(detail)
    return adjusted, ledger, [next(annotated) if a['type'] in relevant else a for a in actions]
