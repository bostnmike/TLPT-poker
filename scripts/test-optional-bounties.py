#!/usr/bin/env python3
"""Production-path regressions; practice exports never enter league history."""
import copy
import hashlib
import importlib.util
import json
import re
import shutil
import io
from contextlib import redirect_stdout
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / 'scripts/fixtures/optional-bounties'


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


parser, integrity, knockouts, builder = map(load, ('parse-event-reports', 'audit-site-integrity', 'build-knockouts', 'build-site-data'))


def historical_financial_payload(event, baseline_slugs):
    # These hashes freeze the original roster's complete records. The parser
    # also seeds zero rows for later registrations; those are not appearances.
    # Never ignore a newly added identity with any actual historical activity.
    for player in event['players']:
        if player['slug'] not in baseline_slugs:
            if any(value != 0 for key, value in player.items() if key not in ('name', 'slug')):
                raise ValueError(f"Unexpected historical activity for {player['slug']}")
    return {
        'players': [p for p in event['players'] if p['slug'] in baseline_slugs],
        'winners': event['winners'],
        'summary': {k: v for k, v in event['summary'].items() if k in
                    ['buyIns', 'rebuys', 'entries', 'totalPot', 'paidSpots', 'entryAmount', 'bounty']}
    }


class Audit:
    def __init__(self):
        self.failures = []

    def check(self, ok, section, message):
        if not ok:
            self.failures.append(message)


class OptionalBountiesTests(unittest.TestCase):
    def setUp(self):
        self.metadata = parser.load_json(parser.METADATA_PATH)['players']
        self.aliases = parser.build_alias_map(self.metadata)
        self.rule = dict(entryAmount=30, detailedHistoryFile='history.txt',
                         regularPayoutsByPlayer={'alex-c': 195, 'ai-dave': 117, 'ahmed': 78, 'rob-f': 0},
                         bounty=dict(mode='optional-rebuy', amount=5, retainIfUnbusted=True, winnerOnlyRollover=True))

    def parse(self, directory=None, rule=None):
        return parser.parse_report_file((directory or FIXTURES/'authentic-test2')/'summary.html',
            self.aliases, self.metadata, 30, {'events': {'2026-10-18': rule or self.rule}})

    def audit(self, event, directory=None, rule=None):
        directory = directory or FIXTURES/'authentic-test2'
        result = Audit()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'2026-10-18.json'
            path.write_text(json.dumps(event))
            with patch.object(integrity, 'RAW_DIR', directory):
                integrity.audit_events(result, [path], self.metadata, {'buy_in_amount': 30},
                                       {'events': {'2026-10-18': rule or self.rule}})
        return result.failures

    def mutated(self, history=None, summary=None, rule=None):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            for name, change in [('history.txt', history), ('summary.html', summary)]:
                text = (FIXTURES/'authentic-test2'/name).read_text()
                (directory/name).write_text(change(text) if change else text)
            return self.parse(directory, rule)

    def test_authentic_pair_and_exact_expected_results(self):
        for name, record in json.loads((FIXTURES/'authentic-test2/source-manifest.json').read_text()).items():
            data = (FIXTURES/'authentic-test2'/name).read_bytes()
            self.assertEqual(len(data), record['bytes'])
            self.assertEqual(hashlib.sha256(data).hexdigest(), record['sha256'])
        event = self.parse()
        rows = {r['slug']: r for r in event['players'] if r['entries']}
        expected = {'alex-c': (6, 2, 1, 20, 5, 5, 195, 10, 215, 200, 15),
                    'ai-dave': (3, 5, 2, 15, 10, 0, 117, 0, 127, 105, 22),
                    'ahmed': (1, 3, 3, 5, 15, 0, 78, 0, 93, 35, 58),
                    'rob-f': (3, 2, 1, 10, 5, 0, 0, 0, 5, 100, -95)}
        keys = ('entries', 'hits', 'bountiesWon', 'bountyPaid', 'bountyCollected', 'bountyRetained',
                'regularPrize', 'rolloverPrize', 'totalWinnings', 'totalCost', 'profit')
        self.assertEqual({s: tuple(r[k] for k in keys) for s, r in rows.items()}, expected)
        self.assertEqual(rows['rob-f']['timesPlaced'], 0)
        self.assertEqual([(w['slug'], w['payout']) for w in event['winners']], [('alex-c', 205), ('ai-dave', 117), ('ahmed', 78)])
        self.assertEqual(event['summary']['totalPot'], 400)
        self.assertEqual(sum(r['profit'] for r in rows.values()), 0)
        self.assertEqual(self.audit(event), [])
        focus = {c['time'][-8:]: (c['killerEntry'], c['victimEntry'], c['disposition']) for c in event['bountyAccounting']['claims']}
        self.assertEqual(focus['09:06:13'], (2, 2, 'winner_rollover'))
        self.assertEqual(focus['09:06:58'], (4, 1, 'winner_rollover'))
        self.assertEqual(focus['09:06:41'], (3, 3, 'collected'))
        self.assertEqual(focus['09:08:20'], (6, 3, 'collected'))

    def test_winner_opted_out_still_gets_all_rollover(self):
        rule = copy.deepcopy(self.rule)
        rule['regularPayoutsByPlayer'] = {'rob-f': 270, 'ahmed': 160, 'ai-dave': 110, 'alex-c': 0, 'brad-r': 0}
        # Earlier reference 03 is reconstructed markup, not an application export.
        # Adapt only its HTML wrappers and TEST ONLY Kept convention to the real
        # export schema in a temporary directory. Preserve its underlying ledger.
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            text = (FIXTURES/'winner-opted-out/summary.html').read_text()
            text = re.sub(r'<tr><td>([^<]+)</td>', r'<tr><td class="fieldname">\1</td>', text)
            text = text.replace('<td>', '<td class="fieldvalue">')
            text = text.replace('<div id="action-summary">', '<td class="text">').replace('</div></body>', '</td></body>')
            text = text.replace('Kept:</td><td class="fieldvalue">$0.00</td><td class="fieldvalue">(0)',
                                'Kept:</td><td class="fieldvalue">$15.00</td><td class="fieldvalue">(3)')
            (directory/'summary.html').write_text(text)
            (directory/'history.txt').write_bytes((FIXTURES/'winner-opted-out/history.txt').read_bytes())
            event = self.parse(directory, rule)
            self.assertEqual(self.audit(event, directory, rule), [])
        bob = next(r for r in event['players'] if r['slug'] == 'rob-f')
        self.assertEqual((bob['rolloverPrize'], bob['bountyRetained'], bob['bountyCollected'], bob['totalWinnings']), (15, 0, 10, 295))
        self.assertTrue(all(r.get('rolloverPrize', 0) == 0 for r in event['players'] if r['slug'] != 'rob-f'))
        self.assertEqual(sum(r['hits'] for r in event['players']), 17)

    def test_percentage_schedule_is_explicit_and_cent_safe(self):
        rule = copy.deepcopy(self.rule)
        del rule['regularPayoutsByPlayer']
        rule['regularPayoutPercentages'] = {'1': 50, '2': 30, '3': 20}
        self.assertEqual(self.parse(rule=rule), self.parse())
        rule['regularPayoutPercentages'] = {'1': 50.001, '2': 29.999, '3': 20}
        with self.assertRaisesRegex(RuntimeError, 'centRemainderRank'):
            self.parse(rule=rule)
        rule['centRemainderRank'] = 1
        event = self.parse(rule=rule)
        self.assertEqual(sum(w['payout'] for w in event['winners']), 400)
        self.assertEqual(self.audit(event, rule=rule), [])

    def test_fixed_award_is_reserved_before_percentages(self):
        from optional_bounties import regular_prizes
        from decimal import Decimal
        mtt = dict(regularPayoutFixed={'6': 40},
                   regularPayoutPercentages={'1': 38, '2': 24, '3': 16, '4': 12, '5': 10})
        receipts = [dict(slug=str(rank), rank=rank) for rank in range(1, 7)]
        prizes = regular_prizes(mtt, receipts, {r['slug'] for r in receipts}, Decimal(1040), 6)
        self.assertEqual(prizes, {str(i+1): Decimal(v) for i,v in enumerate([380,240,160,120,100,40])})
        with self.assertRaisesRegex(RuntimeError, 'centRemainderRank'):
            regular_prizes(mtt, receipts, {r['slug'] for r in receipts}, Decimal('1040.01'), 6)
        rule = copy.deepcopy(self.rule)
        del rule['regularPayoutsByPlayer']
        rule.update(regularPayoutFixed={'3': 78}, regularPayoutPercentages={'1': 62.5, '2': 37.5})
        self.assertEqual(self.parse(rule=rule), self.parse())
        self.assertEqual(self.audit(self.parse(rule=rule), rule=rule), [])

    def test_missing_or_incomplete_inputs_are_rejected(self):
        for key, value, error in [('detailedHistoryFile', 'absent.txt', 'MISSING_HISTORY'),
                                 ('regularPayoutsByPlayer', {}, 'MISSING_PRIZES'),
                                 ('regularPayoutsByPlayer', {'alex-c': 195, 'ai-dave': 117, 'ahmed': 78}, 'every entrant')]:
            rule = copy.deepcopy(self.rule)
            rule[key] = value
            with self.subTest(key=key, value=value), self.assertRaisesRegex(RuntimeError, error):
                self.parse(rule=rule)

    def test_mismatched_pair_duplicate_entry_and_receipt_inflation_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'PAIR_MISMATCH'):
            self.mutated(history=lambda text: text.replace('10/18/2026', '10/19/2026'))
        with self.assertRaisesRegex(RuntimeError, 'PAIR_MISMATCH|ENTRY_WHILE_ACTIVE|chronological'):
            self.mutated(history=lambda text: text + '\n' + text.splitlines()[-3])
        with self.assertRaisesRegex(RuntimeError, 'RECEIPT_MISMATCH'):
            self.mutated(summary=lambda text: text.replace('received $210.00', 'received $220.00'))

    def test_independent_audit_detects_kept_misclassification_and_double_counting(self):
        base = self.parse()
        for mutation in ('kept', 'bonus', 'claim', 'net'):
            event = copy.deepcopy(base)
            alex = next(r for r in event['players'] if r['slug'] == 'alex-c')
            if mutation == 'kept':
                event['summary']['bounty']['retained'] = 15
                alex['bountyRetained'] = 15
            elif mutation == 'bonus':
                alex['totalWinnings'] += 10
            elif mutation == 'claim':
                next(a for a in event['actions'] if a.get('bountyDisposition') == 'winner_rollover')['bountyDisposition'] = 'collected'
            else:
                alex['rolloverPrize'] = 0
                next(r for r in event['players'] if r['slug'] == 'ahmed')['rolloverPrize'] = 10
            self.assertTrue(self.audit(event), mutation)

    def test_production_knockout_archive_keeps_repeated_entry_claims(self):
        event = self.parse()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory/'2026-10-18.json').write_text(json.dumps(event))
            with patch.object(knockouts, 'PARSED_EVENTS_DIR', directory):
                archive, _ = knockouts.extract_knockout_archive_from_parsed_events()
            self.assertEqual(len(archive['2026-10-18']), 12)
            claims = [r for r in archive['2026-10-18'] if r.get('bountyAmount')]
            self.assertEqual(len(claims), 7)
            self.assertEqual(len({(c['victim'], c['victimEntry']) for c in claims}), 7)

    def test_duplicate_active_entry_in_both_sources_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'ENTRY_WHILE_ACTIVE'):
            self.mutated(history=lambda t: t.replace(t.splitlines()[0], t.splitlines()[0]+'\n'+t.splitlines()[0], 1),
                summary=lambda t: t.replace('9:05:14 am 10/18/2026: Ahmed bought-in',
                    '9:05:14 am 10/18/2026: Ahmed bought-in<br>9:05:14 am 10/18/2026: Ahmed bought-in', 1))

    def test_raw_kept_or_pool_corruption_is_rejected(self):
        for old, new in [('$15.00</td>', '$5.00</td>'), ('$50.00</td>', '$55.00</td>')]:
            with self.subTest(old=old), self.assertRaisesRegex(RuntimeError, 'SUMMARY_BOUNTY_MISMATCH'):
                self.mutated(summary=lambda t: t.replace(old, new, 1))

    def test_every_historical_event_financial_result_is_unchanged(self):
        financials = parser.load_json(parser.EVENT_FINANCIALS_PATH)
        hashes = json.loads((FIXTURES/'historical-financials.json').read_text())
        baseline_slugs = set(json.loads((FIXTURES/'historical-player-slugs.json').read_text()))
        found = set()
        for path in parser.production_raw_files():
            event = parser.parse_report_file(path, self.aliases, self.metadata, 30, financials)
            if event['eventId'] not in hashes:
                continue
            found.add(event['eventId'])
            payload = historical_financial_payload(event, baseline_slugs)
            actual = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',',':')).encode()).hexdigest()
            self.assertEqual(actual, hashes[event['eventId']], event['eventId'])
        self.assertEqual(found, set(hashes))
        self.assertEqual(len(hashes), 55)
        self.assertFalse(any('fixtures' in str(path) for path in parser.production_raw_files()))

    def mtt(self, mutate_rule=None, mutate_history=None):
        rule = copy.deepcopy(parser.load_json(parser.EVENT_FINANCIALS_PATH)['events']['2026-10-24'])
        if mutate_rule:
            mutate_rule(rule)
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            summary = 'Event Report 2026-10-24.html'
            shutil.copyfile(parser.RAW_EVENTS_DIR/summary, directory/summary)
            history = (parser.RAW_EVENTS_DIR/rule['detailedHistoryFile']).read_text()
            (directory/rule['detailedHistoryFile']).write_text(mutate_history(history) if mutate_history else history)
            event = parser.parse_report_file(directory/summary, self.aliases, self.metadata, 30,
                                             {'events': {'2026-10-24': rule}})
            from audit_optional_bounties import audit_optional_event
            result = Audit()
            audit_optional_event(result, event, directory/summary, rule, self.metadata, parser)
            self.assertEqual(result.failures, [])
            return event

    def test_mtt_confirmed_chop_reloads_and_actual_cash(self):
        for filename, digest in {
            'Event Report 2026-10-24.html': '5913d29f95894ed10d8decce84ec890d0353770a1fef75ba9df19f5bb58077ad',
            'Event History 2026-10-24.txt': '02183cb6c69a651e5ba4a87884c1d23f916f5617238831140f4ea9699c2d676c',
        }.items():
            self.assertEqual(hashlib.sha256((parser.RAW_EVENTS_DIR/filename).read_bytes()).hexdigest(), digest)
        event = self.mtt()
        rows = {r['slug']: r for r in event['players']}
        self.assertEqual((event['summary']['buyIns'], event['summary']['rebuys']), (17, 18))
        self.assertEqual(sum(r['hits'] for r in rows.values()), 31)
        self.assertEqual(sum(r['bountiesWon'] for r in rows.values()), 27)
        self.assertEqual(sum(r['bountyPaid'] for r in rows.values()), 300)
        self.assertEqual(sum(r['bountyRetained'] for r in rows.values()), 20)
        self.assertEqual(sum(r['rolloverPrize'] for r in rows.values()), 10)
        self.assertEqual((sum(r['totalCost'] for r in rows.values()), sum(r['totalWinnings'] for r in rows.values())), (1700, 1710))
        self.assertEqual(sum(r['profit'] for r in rows.values()), 10)
        self.assertEqual(rows['wild-bill']['totalWinnings'], 20)
        self.assertEqual((rows['wild-bill']['bountiesWon'], rows['wild-bill']['bountyCollected'],
                          rows['wild-bill']['bountyRetained'], rows['wild-bill']['settlementAdjustment'],
                          rows['wild-bill']['timesPlaced']), (1, 10, 0, 10, 0))
        expected = {'liam-o': (370, 20, 10, 400), 'providencemike': (480, 0, 10, 490),
                    'li-fo': (220, 60, 0, 280), 'hiro': (165, 30, 0, 195),
                    'ahmed': (135, 30, 0, 165), 'nasa-al': (40, 10, 0, 50)}
        for slug, values in expected.items():
            self.assertEqual(tuple(rows[slug][k] for k in ('tournamentWinnings','bountyCollected','bountyRetained','totalWinnings')), values)
        self.assertEqual([(w['slug'], w['rank']) for w in event['winners'][:2]], [('liam-o', 1), ('providencemike', 1)])
        reloads = [a for a in event['actions'] if a.get('isReload')]
        self.assertEqual([(a['slug'], a['entryOrdinal'], a['activeEntryOrdinal']) for a in reloads], [('hiro', 2, 1), ('providencemike', 2, 1)])
        hiro_bust = next(c for c in event['bountyAccounting']['claims'] if c['victim'] == 'hiro')
        self.assertEqual((hiro_bust['victimEntry'], hiro_bust['amount']), (1, 10))
        self.assertEqual(rows['kishan']['entries'], 0)
        self.assertEqual(rows['the-architect']['bubbles'], 1)
        self.assertEqual(sum(r['timesPlaced'] for r in rows.values()), 6)

    def test_unscheduled_mtt_placeholder_does_not_require_a_dated_financial_rule(self):
        financials = parser.load_json(parser.EVENT_FINANCIALS_PATH)
        for date in ('Date TBD', 'TBD', ' date tbd '):
            with self.subTest(date=date):
                result = Audit()
                integrity.audit_event_financial_config(result, financials, {'events': [{'slot': 'mtt', 'date': date}]})
                self.assertEqual(result.failures, [])
        # Even with a placeholder, completed-event configuration is never exempt.
        invalid = copy.deepcopy(financials)
        invalid['events']['2026-10-24']['entryAmount'] = 0
        result = Audit()
        integrity.audit_event_financial_config(result, invalid, {'events': [{'slot': 'mtt', 'date': 'Date TBD'}]})
        self.assertTrue(any('entryAmount must be positive' in e for e in result.failures))

    def test_mtt_schedule_rejects_partial_dates_and_requires_rules_when_dated(self):
        financials = parser.load_json(parser.EVENT_FINANCIALS_PATH)
        for date in ('Saturday, 2026', '', None, 'Saturday, February 30, 2027'):
            with self.subTest(date=date):
                result = Audit()
                integrity.audit_event_financial_config(result, financials, {'events': [{'slot': 'mtt', 'date': date}]})
                self.assertEqual(len(result.failures), 1)
                self.assertIn('complete date', result.failures[0])
        result = Audit()
        integrity.audit_event_financial_config(result, financials, {'events': [{'slot': 'mtt', 'date': 'Saturday, November 14, 2026'}]})
        self.assertEqual(result.failures, ['Scheduled MTT is missing an event-financial rule'])
        result = Audit()
        integrity.audit_event_financial_config(result, financials, {'events': [{'slot': 'mtt', 'date': 'Saturday, October 24, 2026'}]})
        self.assertEqual(result.failures, [])

    def test_mtt_requires_each_explicit_confirmation(self):
        for key, error in [('chopFinalists', 'ambiguous chops'), ('rolloverRecipient', 'recipient'),
                           ('reloads', 'ENTRY_WHILE_ACTIVE'), ('allowOmittedZeroReceipts', 'receipt'),
                           ('settlementAdjustmentsByPlayer', 'actual receipt'),
                           ('sourceRolloverAllocationsByPlayer', 'reconciled')]:
            with self.subTest(key=key), self.assertRaisesRegex(RuntimeError, error):
                self.mtt(lambda r: r.pop(key))
        with self.assertRaisesRegex(RuntimeError, 'actual receipt'):
            self.mtt(lambda r: r['actualReceiptsByPlayer'].update(providencemike=480))

    def test_mtt_undo_and_unknown_action_guards(self):
        with self.assertRaisesRegex(RuntimeError, 'UNDO_MISMATCH'):
            self.mtt(mutate_history=lambda t: t.replace('Undo buy-in for Ahmed (Fee: $40.00', 'Undo buy-in for Ahmed (Fee: $50.00', 1))
        with self.assertRaisesRegex(RuntimeError, 'unsupported history action'):
            self.mtt(mutate_history=lambda t: t.replace('Start of round 1\n', 'Unrecorded cash payment\n', 1))
        with self.assertRaisesRegex(RuntimeError, 'configured reload absent'):
            self.mtt(lambda r: r['reloads'].append({'slug':'hiro','time':'2026-10-24T14:51:21'}))

    def test_mtt_independent_audit_rejects_settlement_as_bounty_or_prize(self):
        from audit_optional_bounties import audit_optional_event
        event = self.mtt()
        rule = parser.load_json(parser.EVENT_FINANCIALS_PATH)['events']['2026-10-24']
        for field in ('bountiesWon', 'bountyRetained', 'timesPlaced', 'tournamentWinnings', 'settlementAdjustment'):
            changed = copy.deepcopy(event)
            bill = next(r for r in changed['players'] if r['slug'] == 'wild-bill')
            bill[field] += 1
            result = Audit()
            audit_optional_event(result, changed, parser.RAW_EVENTS_DIR/'Event Report 2026-10-24.html', rule, self.metadata, parser)
            self.assertTrue(result.failures, field)

    def test_historical_guard_allows_registration_but_not_phantom_results(self):
        event = {'players': [{'name': 'Original', 'slug': 'original', 'entries': 1, 'profit': -30}],
                 'winners': [], 'summary': {'entries': 1, 'totalPot': 30}}
        expected = historical_financial_payload(event, {'original'})
        newcomer = {'name': 'New registration', 'slug': 'new-registration', 'entries': 0, 'profit': 0}
        event['players'].append(newcomer)
        self.assertEqual(historical_financial_payload(event, {'original'}), expected)
        for field in ('entries', 'profit', 'hits', 'bountyCollected'):
            with self.subTest(field=field):
                changed = copy.deepcopy(event)
                changed['players'][-1][field] = 1
                with self.assertRaisesRegex(ValueError, 'Unexpected historical activity'):
                    historical_financial_payload(changed, {'original'})

    def test_full_derived_outputs_and_audits_with_optional_event(self):
        rule = copy.deepcopy(self.rule)
        rule['regularPayoutsByPlayer'] = {'alex-c': 195.01, 'ai-dave': 116.99, 'ahmed': 78, 'rob-f': 0}
        event = self.parse(rule=rule)
        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(io.StringIO()):
            root = Path(tmp)
            parsed, generated = root/'parsed', root/'data/generated'
            parsed.mkdir()
            generated.mkdir(parents=True)
            for path in parser.PARSED_EVENTS_DIR.glob('*.json'):
                if path.name != 'index.json':
                    shutil.copyfile(path, parsed/path.name)
            (parsed/'2026-10-18.json').write_text(json.dumps(event))
            output = generated/'site-data.json'
            with patch.object(builder, 'PARSED_EVENTS_DIR', parsed), patch.object(builder, 'GENERATED_DIR', generated), patch.object(builder, 'OUTPUT_PATH', output):
                builder.main()
            site = json.loads(output.read_text())
            events = [json.loads(p.read_text()) for p in sorted(parsed.glob('*.json'))]
            result = Audit()
            expected = integrity.aggregate_players(self.metadata, events)
            integrity.audit_players(result, expected, site, parser.load_json(parser.CONFIG_PATH))
            self.assertEqual(result.failures, [])
            validator = load('validate-site-data')
            for row in site['players']:
                self.assertEqual(validator.validate_player(row), [], row['slug'])
            alex = next(r for r in site['players'] if r['slug'] == 'alex-c')
            old_alex = next(r for r in parser.load_json(ROOT/'data/generated/site-data.json')['players'] if r['slug'] == 'alex-c')
            self.assertAlmostEqual(alex['profit']-old_alex['profit'], 15.01)
            self.assertAlmostEqual(alex['roi'], alex['profit']/alex['totalCost'])
            with patch.object(knockouts, 'PARSED_EVENTS_DIR', parsed):
                archive, _ = knockouts.extract_knockout_archive_from_parsed_events()
            runtime = knockouts.rebuild_runtime_from_archive(archive)
            knockouts.validate_runtime(runtime, archive)
            (root/'knockout-events-full.json').write_text(json.dumps(archive))
            for path in [root/'knockouts.json', generated/'knockouts.json', generated/'knockouts-generated.json']:
                path.write_text(json.dumps(runtime))
            with patch.object(integrity, 'ROOT', root), patch.object(integrity, 'DATA', root/'data'):
                integrity.audit_knockouts(result, events, site)
            self.assertEqual(result.failures, [])


if __name__ == '__main__':
    unittest.main()
