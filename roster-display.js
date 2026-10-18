/* Presentation only: preserve source order, global ranks, identities and totals. */
window.TLPTRoster = (() => {
  const isAlumni = player => player?.rosterStatus === "alumni";
  const split = (items, playerOf = item => item) => {
    const active = [], alumni = [];
    items.forEach((item, index) => (isAlumni(playerOf(item, index)) ? alumni : active).push({ item, index }));
    return { active, alumni };
  };
  const ordered = (items, playerOf) => {
    const { active, alumni } = split(items, playerOf);
    return [...active, ...alumni].map(row => row.item);
  };
  const sections = (items, renderItem, options = {}) => {
    const { active, alumni } = split(items, options.playerOf);
    const render = rows => options.renderGroup
      ? options.renderGroup(rows.map(row => row.item))
      : rows.map(row => renderItem(row.item, row.index)).join("");
    if (!alumni.length) return render(active);
    const heading = (label, count, kind) => {
      const content = `<span>${label} <small>(${count})</small></span>${options.ranked ? '<small>League-wide ranks retained</small>' : ''}`;
      return options.columns
        ? `<tr class="roster-section-row" data-roster-section="${kind}"><th colspan="${options.columns}" scope="rowgroup">${content}</th></tr>`
        : `<h3 class="roster-section-heading" data-roster-section="${kind}">${content}</h3>`;
    };
    return (active.length ? heading(options.activeLabel || "Active players", active.length, "active") + render(active) : "")
      + heading(options.alumniLabel || "Alumni", alumni.length, "alumni") + render(alumni);
  };
  const options = (items, renderOption) => {
    const { active, alumni } = split(items);
    if (!alumni.length) return active.map(row => renderOption(row.item)).join("");
    return (active.length ? `<optgroup label="Active players">${active.map(row => renderOption(row.item)).join("")}</optgroup>` : "")
      + `<optgroup label="Alumni">${alumni.map(row => renderOption(row.item)).join("")}</optgroup>`;
  };
  return Object.freeze({ isAlumni, split, ordered, sections, options });
})();
