-- Apply the Commish's league default to every retained event in one state write.
-- MTT is $40 + $10; other formats are $30 + $10, including rebuys.
UPDATE rsvp_state
SET body = json_set(
      body,
      '$.events', json((
        SELECT json_group_array(json_set(
          value,
          '$.metadata.rsvpBuyInCents',
          CASE WHEN json_extract(value, '$.metadata.slot') = 'mtt' THEN 4000 ELSE 3000 END,
          '$.metadata.rsvpRebuyCents',
          CASE WHEN json_extract(value, '$.metadata.slot') = 'mtt' THEN 4000 ELSE 3000 END,
          '$.metadata.rsvpBountyCents', 1000,
          '$.metadata.rsvpBountyOnRebuy', json('true')
        ))
        FROM json_each(rsvp_state.body, '$.events')
      )),
      '$.revision', revision + 1,
      '$.updatedAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      '$.audit', json_insert(
        coalesce(json_extract(body, '$.audit'), json('[]')), '$[#]',
        json_object(
          'at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          'actor', 'commish',
          'type', 'default-bounty-rebuys',
          'bountyCents', 1000,
          'bountyOnRebuy', json('true'),
          'regularBaseCents', 3000,
          'mttBaseCents', 4000
        )
      )
    ),
    revision = revision + 1
WHERE id = 1 AND json_array_length(body, '$.events') > 0;
