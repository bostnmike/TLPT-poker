/* Written guides reflect the existing calculations; audio is enabled only after review. */
window.TLPTStatsGuides = {
  standings: {
    portrait: 'classic',
    title: 'Standings', audio: 'media/norm-narrates/norm-standings.mp3', scope: true,
    intro: 'The league ledger: compare the numbers side by side, then choose what determines the order.',
    sections: [
      ['Start here', 'Choose a metric button to sort the table from highest to lowest. Select a player name to open their profile. On a narrow screen, swipe the table sideways to see every column.'],
      ['Money versus profit', 'Total Take-home includes tournament prizes, bounty returns and confirmed settlement adjustments. Profit subtracts tournament and bounty costs. Bounty net is already included in profit; do not add it again.'],
      ['Appearances versus entries', 'Buy-Ins counts initial tournament appearances. Rebuys includes rebuys and reloads. Entries combines both. Cashes count tournament cash finishes, not bounty collections; bubbles are finishes one place outside the money. Every recorded elimination counts as a hit.'],
      ['Who appears', 'The combined career view requires at least two entries. A filtered view includes players with a matching appearance. Active players and alumni are grouped separately while retaining their overall ranks. Higher is not always better: bubbles and rebuys are counts, not trophies.']
    ]
  },
  'form-lab': {
    portrait: 'detective',
    title: 'The Form Lab', audio: 'media/norm-narrates/norm-form-lab.mp3', scope: true,
    intro: 'Explore one player’s event results as a scatter plot. Each point is an appearance, not another player.',
    sections: [
      ['Start here', 'Choose a Player, a Preset comparison and a Window: the last six, last ten, or all matching appearances. Select a point or an event-history card to inspect that night. Keyboard users can focus a point and press Enter or Space.'],
      ['Read the axes first', 'The default compares Event Volatility on the horizontal axis with Form Score on the vertical axis. Upper-left means lower modeled event volatility and stronger form. That interpretation changes when you change axes. Finish Depth measures relative finishing strength; Profit measures money after costs.'],
      ['Customize your evidence', 'Open Customize axes & chart options to choose your own measures and toggle event labels, the trend line or player average. Custom presets open these options automatically. The trend line describes the displayed points; it does not predict the next result.'],
      ['Keep the sample honest', 'Event filters narrow the eligible appearances before the window is applied. Form Score and Event Volatility are this page’s event-level measures, not the career Power rating or the Heater Meter’s ranking. A handful of points is a conversation starter, not a verdict.']
    ]
  },
  'player-movement': {
    portrait: 'weather',
    title: 'The Heater Meter', audio: 'media/norm-narrates/norm-heater-meter.mp3', scope: true,
    intro: 'Recent form and direction—not a replacement for the career rankings.',
    sections: [
      ['Start here', 'Choose Hot, Cold, Consistent or Volatile. The leaders and full board use your selected mode. Players need four matching appearances to qualify; the calculations use their last six matching appearances, or all available if fewer than six.'],
      ['What the four views mean', 'Hot and Cold sort by improving or declining finish-depth momentum, with Form Score as a tie-break. Consistent balances Form Score against finish-depth volatility. Volatile highlights the biggest swings in finishing depth. Consistent does not simply mean the smallest swings.'],
      ['What adds heat', 'Form Score uses finishing position relative to field size, knockouts, rebuys, bubbles and clean runs. Deeper finishes and knockouts help; rebuys and early exits hurt. More recent events receive more weight. A bubble can add form credit even though it is not a cash.'],
      ['Read the window', 'The board shows each player’s recent sample and matching appearance count. Narrow filters may leave nobody qualified. Reset to All broadens the sample; it does not manufacture a heater or change career awards.']
    ]
  },
  streaks: {
    portrait: 'clock',
    title: 'The Streak Tracker', audio: 'media/norm-narrates/norm-streaks.mp3', scope: true,
    intro: 'Follow consecutive tournament cashes and consecutive misses across appearances a player actually made.',
    sections: [
      ['Start here', 'Compare Active Cash Streaks and Active Droughts with the longest historical runs. Use Player Streak Lookup for an individual’s run lengths, dates and events.'],
      ['What counts as a run', 'A cash streak is consecutive matching appearances ending in tournament cashes. A drought is consecutive matching appearances without a tournament cash. Bounty money alone does not count as a cash. Players need two matching appearances, and only runs of two or more are listed.'],
      ['Active does not mean attending tonight', 'An active run reaches that player’s most recent matching appearance. Missing a game neither breaks nor extends it. Events excluded by your filters are skipped too, so a filtered run describes the selected slice rather than the complete career.'],
      ['Read the dates', 'Historical bests and active runs answer different questions. Check the dates before declaring somebody unstoppable—or overdue. A quiet week on the schedule is not a statistical recovery.']
    ]
  },
  knockouts: {
    portrait: 'hockey',
    title: 'Knockout Central', audio: 'media/norm-narrates/norm-knockouts.mp3', scope: true,
    intro: 'Who eliminated whom, how often, and which rivalries have receipts.',
    sections: [
      ['Start here', 'Use Knockouts for the full elimination picture, or Bounty Hunters for the bounty subset. The jump links take you to leaders, rivalries, nemeses and the Body Count ledger. Select player links for the full profile.'],
      ['A hit is an elimination', 'Every recorded elimination counts, whether or not a bounty was attached. Eliminating a player who later rebuys still counts. A live-stack reload is not a knockout. The page records eliminated entries; it does not imply every victim went home for the night.'],
      ['Read the rivalry', 'The Vendetta Ledger compares head-to-head eliminations. Nemeses show the opponents responsible for a player’s bustouts, and the Body Count ledger expands the wider record. These are elimination counts, not a record of every hand won.'],
      ['Bounties are a subset', 'Only qualifying bounty eliminations earn bounty-win credit. Use Bounty Hunters to distinguish wins from money collected, retained and paid. A bounty filter selects whole events, including people who opted out.']
    ]
  },
  bounties: {
    portrait: 'explorer',
    title: 'Bounty Hunters', audio: 'media/norm-narrates/norm-bounty-hunters.mp3', scope: true,
    intro: 'The bounty subset of the knockout story, with the money kept straight.',
    sections: [
      ['Start here', 'Compare the Bounty Leaders, review the Bounty Ledger, then inspect Verified Bounty Claims to see who collected whose bounty. Switch to Knockouts for all eliminations, including those without bounty credit.'],
      ['Wins are not dollars', 'Bounties Won counts qualifying opponent-entry bounties collected. Collected is the money from those claims. Retained is the return of a player’s own surviving bounty. Retaining your own bounty does not add a bounty win.'],
      ['Follow the money', 'Paid is bounty money posted. Returns combine collected and retained money; Net subtracts the amount paid. Bounty net already contributes to overall profit. Winner-only forfeitures are prize money, not bounty claims. Confirmed settlement adjustments stay separate from bounty-win counts.'],
      ['Eligibility matters', 'Rules vary by event and entry. A knockout does not automatically entitle the eliminator to a bounty. With Bounties selects matching events, not just players who opted in. Without Bounties may legitimately leave this ledger empty.']
    ]
  },
  players: {
    portrait: 'explorer',
    title: 'Meet the Crew', audio: 'media/norm-narrates/norm-meet-the-crew.mp3', scope: false,
    intro: 'Find the players, explore their career cards, or compare career reputation with recent form.',
    sections: [
      ['Start here', 'Choose Active, Alumni or All, then search by name. Use Cards or Crew Map for the display, and By Tier or By Archetype for grouping. Tier buttons narrow the lineup. Developing players remain available through their tiers and the additional-player controls.'],
      ['Read the Crew Map', 'Right means a higher career card rating; up means a stronger Last Five rating. Avatar size reflects appearances, capped at sixty. Dashed lines are league medians fixed across filters. Where avatars overlap, leader lines retain the exact score locations.'],
      ['Explore a player', 'Select an avatar or use the map’s player selector to inspect exact values and open the profile. Five appearances are needed for the map. Players still building a sample remain available in Cards.'],
      ['Roster is not a reset', 'Alumni keep their history and can return. Filtering, changing display or revealing more players does not recalculate anyone’s career rating, tier or earned awards. The map visualizes existing ratings; it does not create a new ranking system.']
    ]
  },
  player: {
    portrait: 'host',
    title: 'Player Profiles', audio: 'media/norm-narrates/norm-player-profile.mp3', scope: true,
    intro: 'One player’s career identity and event results, with the distinction kept visible.',
    sections: [
      ['Start here', 'Use Previous Player, Next Player or The Crew to move through profiles. Explore the player’s card, statistical tiles and knockout history. Focus or hover a stat tile to see its calculation.'],
      ['Know what changes', 'Event filters update factual result statistics and the matching knockout history. Career identity, card ratings, tiers and earned awards remain based on the full career. Measures labeled Career are not recalculated for your event selection.'],
      ['Read financial results', 'Take-home is not profit. Profit subtracts tournament and bounty costs from total receipts, including confirmed settlement adjustments. Bounty net is already included. A tournament cash and a bounty collection are different achievements.'],
      ['Give small samples room', 'Rate statistics and recent card views need context. Read the appearance counts and card-view labels before comparing a new player with a long-time regular. A filtered result changes the lens, not the player’s history.']
    ]
  }
};
