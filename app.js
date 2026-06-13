const PARTY = {
  democrat: {
    label: "Democratic",
    short: "D",
    color: "#277da1",
    rgb: "39, 125, 161",
  },
  republican: {
    label: "Republican",
    short: "R",
    color: "#d97706",
    rgb: "217, 119, 6",
  },
  other: {
    label: "Other",
    short: "O",
    color: "#7b61a8",
    rgb: "123, 97, 168",
  },
};

const STATE_LINE_COLORS = [
  "#173d2b",
  "#277da1",
  "#d97706",
  "#7b61a8",
  "#b2475a",
];

const state = {
  data: null,
  years: [],
  selectedYear: 2024,
  selectedParty: "all",
  selectedStates: [],
  selectedDemographic: "race",
  focusedState: null,
  sort: { key: "marginShare", direction: "desc" },
};

const dom = {};
const numberFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheDom();

  try {
    if (window.ELECTION_DATA) {
      state.data = window.ELECTION_DATA;
    } else {
      const response = await fetch("./data/elections.json");
      if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
      state.data = await response.json();
    }
    state.years = Object.keys(state.data.elections).map(Number).sort((a, b) => a - b);
    state.selectedYear = state.years.at(-1);
    populateControls();
    bindEvents();
    renderAll();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `
      <main class="empty-state" style="min-height:100vh">
        <span aria-hidden="true">!</span>
        <h1>Election data could not be loaded</h1>
        <p>Run this folder through a local static web server rather than opening index.html directly.</p>
      </main>
    `;
  }
}

function cacheDom() {
  const ids = [
    "year-slider", "year-select", "year-output", "hero-year", "hero-year-shadow",
    "party-filter", "state-filter", "clear-states", "demographic-filter",
    "demographic-help", "live-status", "summary-winner", "summary-winner-share",
    "summary-closest", "summary-closest-margin", "summary-turnout", "summary-states",
    "summary-state-split", "state-map", "map-detail", "national-chart",
    "national-legend", "state-chart", "state-chart-title", "state-trend-legend",
    "demographic-year-label", "demographic-title", "demographic-legend",
    "demographic-chart", "demographic-empty", "demographic-empty-copy",
    "demographic-source", "results-body", "table-count",
  ];

  for (const id of ids) dom[toCamel(id)] = document.getElementById(id);
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function populateControls() {
  dom.yearSlider.max = String(state.years.length - 1);
  dom.yearSlider.value = String(state.years.indexOf(state.selectedYear));
  dom.yearSelect.innerHTML = state.years
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");
  dom.yearSelect.value = String(state.selectedYear);

  dom.stateFilter.innerHTML = state.data.states
    .map((item) => `<option value="${item.code}">${item.name}</option>`)
    .join("");
}

function bindEvents() {
  dom.yearSlider.addEventListener("input", (event) => {
    selectYear(state.years[Number(event.target.value)]);
  });

  dom.yearSelect.addEventListener("change", (event) => {
    selectYear(Number(event.target.value));
  });

  dom.partyFilter.addEventListener("change", (event) => {
    state.selectedParty = event.target.value;
    renderAll();
  });

  dom.stateFilter.addEventListener("change", () => {
    const selected = [...dom.stateFilter.selectedOptions].map((option) => option.value);
    state.selectedStates = selected.slice(0, 5);
    syncStateOptions();
    if (selected.length > 5) {
      announce("State comparison is limited to five states.");
    }
    state.focusedState = state.selectedStates[0] ?? null;
    renderAll();
  });

  dom.clearStates.addEventListener("click", () => {
    state.selectedStates = [];
    state.focusedState = null;
    syncStateOptions();
    renderAll();
  });

  dom.demographicFilter.addEventListener("change", (event) => {
    state.selectedDemographic = event.target.value;
    renderDemographics();
  });

  document.querySelectorAll("th button[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (state.sort.key === key) {
        state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
      } else {
        state.sort.key = key;
        state.sort.direction = key === "name" || key === "winner" ? "asc" : "desc";
      }
      renderTable();
    });
  });
}

function selectYear(year) {
  state.selectedYear = year;
  dom.yearSlider.value = String(state.years.indexOf(year));
  dom.yearSelect.value = String(year);
  state.focusedState = state.selectedStates[0] ?? null;
  renderAll();
}

function renderAll() {
  const year = state.selectedYear;
  dom.yearOutput.value = year;
  dom.yearOutput.textContent = year;
  dom.heroYear.textContent = year;
  dom.heroYearShadow.textContent = year;

  renderSummary();
  renderMap();
  renderNationalChart();
  renderStateChart();
  renderDemographics();
  renderTable();

  announce(
    `${year} election selected. ${filteredStateRecords().length} jurisdictions match the active filters.`,
  );
}

function election() {
  return state.data.elections[state.selectedYear];
}

function filteredStateRecords() {
  return Object.values(election().states).filter((record) => {
    const matchesParty =
      state.selectedParty === "all" || record.winner.party === state.selectedParty;
    const matchesState =
      state.selectedStates.length === 0 || state.selectedStates.includes(record.state);
    return matchesParty && matchesState;
  });
}

function renderSummary() {
  const current = election();
  const nationalParties = current.national.parties;
  const winnerParty = current.national.popularWinner;
  const winner = nationalParties[winnerParty];
  const closest = Object.values(current.states).sort(
    (left, right) => left.marginShare - right.marginShare,
  )[0];
  const stateCounts = { democrat: 0, republican: 0, other: 0 };

  for (const record of Object.values(current.states)) {
    stateCounts[record.winner.party] += 1;
  }

  dom.summaryWinner.textContent = PARTY[winnerParty].label;
  dom.summaryWinnerShare.textContent = `${percent(winner.share)} of the national vote`;
  dom.summaryClosest.textContent = closest.name;
  dom.summaryClosestMargin.textContent =
    `${closest.winner.candidate} by ${percent(closest.marginShare)}`;
  dom.summaryTurnout.textContent = compactFormat.format(current.national.totalVotes);
  dom.summaryStates.textContent = `${stateCounts.democrat} D · ${stateCounts.republican} R`;
  dom.summaryStateSplit.textContent =
    stateCounts.other ? `${stateCounts.other} carried by another party` : "No states carried by another party";
}

function renderMap() {
  const current = election();
  const records = Object.values(current.states);
  const maxMargin = Math.max(...records.map((record) => record.marginShare));
  const partyFilter = state.selectedParty;
  const selectedSet = new Set(state.selectedStates);

  dom.stateMap.innerHTML = state.data.states.map((position) => {
    const record = current.states[position.code];
    const party = record.winner.party;
    const strength = 0.28 + 0.68 * Math.sqrt(record.marginShare / maxMargin);
    const filteredByParty = partyFilter !== "all" && party !== partyFilter;
    const filteredByState = selectedSet.size > 0 && !selectedSet.has(position.code);
    const classes = [
      "state-tile",
      `party-${party}`,
      selectedSet.has(position.code) ? "is-selected" : "",
      filteredByParty || filteredByState ? "is-filtered" : "",
    ].filter(Boolean).join(" ");
    const label =
      `${record.name}: ${record.winner.candidate}, ${PARTY[party].label}, ` +
      `${percent(record.winner.share)}, margin ${percent(record.marginShare)}`;

    return `
      <button
        type="button"
        class="${classes}"
        data-state="${position.code}"
        aria-pressed="${selectedSet.has(position.code)}"
        aria-label="${escapeHtml(label)}"
        style="
          grid-row:${position.row};
          grid-column:${position.column};
          background-color:rgba(${PARTY[party].rgb}, ${strength.toFixed(3)});
        "
      >
        <span class="abbr">${position.code}</span>
        <span class="party-code">${PARTY[party].short}</span>
      </button>
    `;
  }).join("");

  dom.stateMap.querySelectorAll(".state-tile").forEach((tile) => {
    const code = tile.dataset.state;
    tile.addEventListener("mouseenter", () => showMapDetail(code));
    tile.addEventListener("focus", () => showMapDetail(code));
    tile.addEventListener("click", () => toggleState(code));
  });

  if (state.focusedState) {
    showMapDetail(state.focusedState);
  } else {
    dom.mapDetail.innerHTML = `
      <p class="eyebrow">Focus a state</p>
      <h3>Hover, focus, or select a tile</h3>
      <p>State-level winner, vote share, margin, and electoral-vote allocation appear here.</p>
    `;
  }
}

function showMapDetail(code) {
  state.focusedState = code;
  const record = election().states[code];
  const party = record.winner.party;
  dom.mapDetail.innerHTML = `
    <p class="eyebrow">${state.selectedYear} result</p>
    <h3>${escapeHtml(record.name)}</h3>
    <div class="detail-party">
      <i style="background:${PARTY[party].color}"></i>
      ${escapeHtml(record.winner.candidate)} · ${PARTY[party].label}
    </div>
    <div class="detail-grid">
      <div><span>Vote share</span><strong>${percent(record.winner.share)}</strong></div>
      <div><span>Margin</span><strong>${percent(record.marginShare)}</strong></div>
      <div><span>Popular votes</span><strong>${compactFormat.format(record.winner.votes)}</strong></div>
      <div><span>Electoral votes</span><strong>${record.electoralVotes}</strong></div>
    </div>
    <p>${escapeHtml(record.runnerUp.candidate)} finished second with ${percent(record.runnerUp.share)}.</p>
  `;
}

function toggleState(code) {
  if (state.selectedStates.includes(code)) {
    state.selectedStates = state.selectedStates.filter((item) => item !== code);
  } else if (state.selectedStates.length < 5) {
    state.selectedStates = [...state.selectedStates, code];
  } else {
    announce("State comparison is limited to five states.");
    return;
  }

  state.focusedState = code;
  syncStateOptions();
  renderAll();
}

function syncStateOptions() {
  [...dom.stateFilter.options].forEach((option) => {
    option.selected = state.selectedStates.includes(option.value);
  });
}

function renderNationalChart() {
  const width = 760;
  const height = 320;
  const pad = { top: 20, right: 18, bottom: 38, left: 45 };
  const x = (year) =>
    pad.left + ((year - state.years[0]) / (state.years.at(-1) - state.years[0])) *
    (width - pad.left - pad.right);
  const y = (share) =>
    height - pad.bottom - (share / 0.65) * (height - pad.top - pad.bottom);
  const parties = ["democrat", "republican", "other"];
  const ticks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  let svg = "";

  for (const tick of ticks) {
    svg += `
      <line class="grid-line" x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}"></line>
      <text class="axis-label" x="${pad.left - 8}" y="${y(tick) + 3}" text-anchor="end">${Math.round(tick * 100)}%</text>
    `;
  }

  for (const year of state.years) {
    if (year % 8 === 0 || year === state.years.at(-1)) {
      svg += `<text class="axis-label" x="${x(year)}" y="${height - 12}" text-anchor="middle">${year}</text>`;
    }
  }

  svg += `<line class="year-guide" x1="${x(state.selectedYear)}" y1="${pad.top}" x2="${x(state.selectedYear)}" y2="${height - pad.bottom}"></line>`;

  for (const party of parties) {
    const points = state.years.map((year) => ({
      year,
      share: state.data.elections[year].national.parties[party].share,
    }));
    const path = points.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${x(point.year).toFixed(2)} ${y(point.share).toFixed(2)}`,
    ).join(" ");
    const opacity =
      state.selectedParty === "all" || state.selectedParty === party ? 1 : 0.16;

    svg += `<path class="data-line" d="${path}" stroke="${PARTY[party].color}" opacity="${opacity}"></path>`;
    for (const point of points) {
      svg += `
        <circle
          class="data-point"
          cx="${x(point.year)}"
          cy="${y(point.share)}"
          r="${point.year === state.selectedYear ? 5.5 : 3.4}"
          fill="${PARTY[party].color}"
          opacity="${opacity}"
        >
          <title>${point.year} ${PARTY[party].label}: ${percent(point.share)}</title>
        </circle>
      `;
    }
  }

  dom.nationalChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="National party vote share by election year">
      ${svg}
    </svg>
  `;
  dom.nationalLegend.innerHTML = parties
    .map((party) => `<span><i style="background:${PARTY[party].color}"></i>${PARTY[party].label}</span>`)
    .join("");
}

function renderStateChart() {
  if (state.selectedStates.length === 0) {
    dom.stateChartTitle.textContent = "Select states to compare";
    dom.stateChart.innerHTML = `
      <div class="empty-state">
        <span aria-hidden="true">+</span>
        <h3>Build a state trend</h3>
        <p>Select up to five states from the filter or the map.</p>
      </div>
    `;
    dom.stateTrendLegend.innerHTML = "";
    return;
  }

  const width = 600;
  const height = 320;
  const pad = { top: 20, right: 18, bottom: 38, left: 44 };
  const x = (year) =>
    pad.left + ((year - state.years[0]) / (state.years.at(-1) - state.years[0])) *
    (width - pad.left - pad.right);
  const y = (margin) =>
    pad.top + ((0.6 - margin) / 1.2) * (height - pad.top - pad.bottom);
  const ticks = [-0.6, -0.3, 0, 0.3, 0.6];
  let svg = "";

  for (const tick of ticks) {
    svg += `
      <line class="grid-line" x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}" ${tick === 0 ? 'style="stroke:#18211b;stroke-dasharray:none;opacity:.55"' : ""}></line>
      <text class="axis-label" x="${pad.left - 7}" y="${y(tick) + 3}" text-anchor="end">${marginLabel(tick)}</text>
    `;
  }

  for (const year of state.years) {
    if (year % 8 === 0 || year === state.years.at(-1)) {
      svg += `<text class="axis-label" x="${x(year)}" y="${height - 12}" text-anchor="middle">${year}</text>`;
    }
  }

  svg += `<line class="year-guide" x1="${x(state.selectedYear)}" y1="${pad.top}" x2="${x(state.selectedYear)}" y2="${height - pad.bottom}"></line>`;

  state.selectedStates.forEach((code, index) => {
    const color = STATE_LINE_COLORS[index];
    const points = state.years.map((year) => {
      const record = state.data.elections[year].states[code];
      return {
        year,
        margin: record.parties.democrat.share - record.parties.republican.share,
      };
    });
    const path = points.map((point, pointIndex) =>
      `${pointIndex === 0 ? "M" : "L"} ${x(point.year).toFixed(2)} ${y(point.margin).toFixed(2)}`,
    ).join(" ");
    svg += `<path class="data-line" d="${path}" stroke="${color}"></path>`;
    for (const point of points) {
      svg += `
        <circle
          class="data-point"
          cx="${x(point.year)}"
          cy="${y(point.margin)}"
          r="${point.year === state.selectedYear ? 5.2 : 3.1}"
          fill="${color}"
        >
          <title>${state.data.elections[point.year].states[code].name}, ${point.year}: ${marginLabel(point.margin)}</title>
        </circle>
      `;
    }
  });

  const names = state.selectedStates.map((code) => election().states[code].name);
  dom.stateChartTitle.textContent =
    names.length === 1 ? `${names[0]} margin` : `${names.length} state margins`;
  dom.stateChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="State partisan vote margin over time">
      ${svg}
    </svg>
  `;
  dom.stateTrendLegend.innerHTML = state.selectedStates.map((code, index) =>
    `<span><i style="background:${STATE_LINE_COLORS[index]}"></i>${escapeHtml(election().states[code].name)}</span>`,
  ).join("");
}

function renderDemographics() {
  const yearData = state.data.demographics[state.selectedYear];
  const allOptions = [...dom.demographicFilter.options];
  const category = state.selectedDemographic;

  dom.demographicYearLabel.textContent = `${state.selectedYear} exit poll`;
  dom.demographicTitle.textContent = `Vote by ${categoryLabel(category).toLowerCase()}`;

  if (!yearData) {
    dom.demographicFilter.disabled = true;
    allOptions.forEach((option) => { option.disabled = true; });
    dom.demographicChart.hidden = true;
    dom.demographicEmpty.hidden = false;
    dom.demographicEmptyCopy.textContent =
      `No bundled exit-poll crosstabs are available for ${state.selectedYear}. ` +
      "This app does not infer demographic voting from election returns.";
    dom.demographicLegend.innerHTML = "";
    dom.demographicSource.textContent =
      "Exit-poll coverage in this edition: 2008, 2012, 2016, 2020, and 2024.";
    return;
  }

  dom.demographicFilter.disabled = false;
  allOptions.forEach((option) => {
    option.disabled = !yearData.categories[option.value];
  });
  dom.demographicFilter.value = category;

  const rows = yearData.categories[category];
  if (!rows) {
    dom.demographicChart.hidden = true;
    dom.demographicEmpty.hidden = false;
    dom.demographicEmptyCopy.textContent =
      `${categoryLabel(category)} is not published in the cited ${state.selectedYear} ` +
      "Roper Center summary. Choose an enabled category.";
    dom.demographicLegend.innerHTML = legendForDemographics(yearData);
  } else {
    dom.demographicChart.hidden = false;
    dom.demographicEmpty.hidden = true;
    dom.demographicChart.innerHTML = rows.map((row) => {
      const other = Math.max(0, 100 - row.democrat - row.republican);
      return `
        <div class="demo-row">
          <div class="demo-label">
            <strong>${escapeHtml(row.label)}</strong>
            <span>${row.electorateShare}% of electorate</span>
          </div>
          <div
            class="stacked-bar"
            role="img"
            aria-label="${escapeHtml(row.label)}: ${yearData.candidates[0].name} ${row.democrat}%, ${yearData.candidates[1].name} ${row.republican}%, other or no response ${other}%"
          >
            ${segment("democrat", row.democrat)}
            ${segment("republican", row.republican)}
            ${segment("other", other)}
          </div>
        </div>
      `;
    }).join("");
    dom.demographicLegend.innerHTML = legendForDemographics(yearData);
  }

  dom.demographicSource.innerHTML =
    `Source: <a href="${yearData.source.url}" target="_blank" rel="noreferrer">` +
    `Roper Center, “How Groups Voted in ${state.selectedYear}”</a>. ` +
    `${yearData.source.methodology}.`;
}

function segment(party, value) {
  if (value < 0.5) return "";
  const muted =
    state.selectedParty !== "all" &&
    state.selectedParty !== party &&
    !(state.selectedParty === "other" && party === "other");
  return `
    <span
      class="bar-segment ${party} ${muted ? "is-muted" : ""}"
      style="width:${value}%"
    >${value >= 6 ? `${Math.round(value)}%` : ""}</span>
  `;
}

function legendForDemographics(yearData) {
  return `
    <span><i style="background:${PARTY.democrat.color}"></i>${escapeHtml(yearData.candidates[0].name)}</span>
    <span><i style="background:${PARTY.republican.color}"></i>${escapeHtml(yearData.candidates[1].name)}</span>
    <span><i style="background:#a9a79f"></i>Other / no response</span>
  `;
}

function renderTable() {
  const records = filteredStateRecords();
  const direction = state.sort.direction === "asc" ? 1 : -1;
  const sorted = [...records].sort((left, right) => {
    let leftValue;
    let rightValue;

    if (state.sort.key === "winner") {
      leftValue = left.winner.candidate;
      rightValue = right.winner.candidate;
    } else if (state.sort.key === "share") {
      leftValue = left.winner.share;
      rightValue = right.winner.share;
    } else {
      leftValue = left[state.sort.key];
      rightValue = right[state.sort.key];
    }

    if (typeof leftValue === "string") {
      return leftValue.localeCompare(rightValue) * direction;
    }
    return (leftValue - rightValue) * direction;
  });

  dom.tableCount.textContent =
    `${records.length} ${records.length === 1 ? "jurisdiction" : "jurisdictions"}`;

  if (sorted.length === 0) {
    dom.resultsBody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state" style="min-height:180px">
          <span aria-hidden="true">∅</span>
          <h3>No matching state results</h3>
          <p>Clear a state selection or change the winning-party filter.</p>
        </div>
      </td></tr>
    `;
    return;
  }

  dom.resultsBody.innerHTML = sorted.map((record) => {
    const party = record.winner.party;
    const barWidth = Math.min(100, (record.marginShare / 0.6) * 100);
    return `
      <tr>
        <td><strong>${escapeHtml(record.name)}</strong> <small>${record.state}</small></td>
        <td>
          <span class="winner-cell">
            <i class="party-dot ${party}"></i>
            ${escapeHtml(record.winner.candidate)}
          </span>
        </td>
        <td>${record.electoralVotes}</td>
        <td>${percent(record.winner.share)} <small>(${numberFormat.format(record.winner.votes)})</small></td>
        <td class="margin-cell">
          ${percent(record.marginShare)}
          <span class="margin-bar-track"><i style="width:${barWidth}%;background:${PARTY[party].color}"></i></span>
        </td>
      </tr>
    `;
  }).join("");
}

function categoryLabel(category) {
  return {
    race: "Race",
    gender: "Gender",
    age: "Age band",
    education: "Education",
    income: "Income",
  }[category];
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function marginLabel(value) {
  if (Math.abs(value) < 0.0005) return "Even";
  return `${value > 0 ? "D" : "R"}+${Math.abs(value * 100).toFixed(0)}`;
}

function announce(message) {
  dom.liveStatus.textContent = "";
  window.setTimeout(() => {
    dom.liveStatus.textContent = message;
  }, 20);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
