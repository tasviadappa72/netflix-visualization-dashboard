// -------- Paths (local files) --------
const DATA_PATH = "./data/Netflix_Dataset.csv";
const WORLD_GEO_PATH = "./data/world.geojson";

const WORLD_TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"; // (kept, but NOT used)

// -------- Layout helpers --------
const margin = { top: 20, right: 20, bottom: 35, left: 45 };
const defaultWidth = 430;
const defaultHeight = 240;

// -------- Color-blind safe palette (Okabe–Ito inspired) --------
const COLORS = {
  primary: "#0072B2",
  green: "#009E73",
  orange: "#E69F00",
  select: "#D55E00",
  white: "#ffffff",
  black: "#000000",
  muted: "#94a3b8",
  text: "#e2e8f0"
};

let allData = [];
let worldGeo = null;
let selectedCountry = null; // map click filter
let selectedDirector = null; // top directors click filter
let selectedType = null; // pie click filter

// Utility: create an SVG in container
function createSvg(containerSelector, width = defaultWidth, height = defaultHeight, customMargin = margin) {
  d3.select(containerSelector).selectAll("*").remove();

  const svg = d3.select(containerSelector)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const g = svg.append("g")
    .attr("transform", `translate(${customMargin.left},${customMargin.top})`);

  const innerWidth = width - customMargin.left - customMargin.right;
  const innerHeight = height - customMargin.top - customMargin.bottom;

  return { svg, g, width: innerWidth, height: innerHeight };
}

// Helpers: parsing
function parseCountries(countryStr) {
  if (!countryStr) return [];
  return countryStr.split(",").map(d => d.trim()).filter(Boolean);
}

function parseGenres(genreStr) {
  if (!genreStr) return [];
  return genreStr.split(",").map(d => d.trim()).filter(Boolean);
}

// Init filters
function initFilters(data) {
  // Year slider
  const years = data.map(d => +d.release_year).filter(Boolean);
  const minYear = d3.min(years);
  const maxYear = d3.max(years);

  const slider = d3.select("#yearSlider");
  slider
    .attr("min", minYear)
    .attr("max", maxYear)
    .attr("value", maxYear)
    .on("input", function () {
      d3.select("#yearLabel").text(this.value);
      updateAll();
    });

  d3.select("#yearLabel").text(maxYear);

  // Genre select
  const genreSet = new Set();
  data.forEach(d => parseGenres(d.listed_in).forEach(g => genreSet.add(g)));
  const genres = ["All genres", ...Array.from(genreSet).sort()];

  const genreSel = d3.select("#genreSelect");
  genreSel.selectAll("option").remove();
  genreSel
    .selectAll("option")
    .data(genres)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  genreSel.on("change", updateAll);

  // Rating select
  const ratingSet = new Set(data.map(d => d.rating).filter(Boolean));
  const ratings = ["All ratings", ...Array.from(ratingSet).sort()];

  const ratingSel = d3.select("#ratingSelect");
  ratingSel.selectAll("option").remove();
  ratingSel
    .selectAll("option")
    .data(ratings)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  ratingSel.on("change", updateAll);

  d3.select("#countryLabel").text("All countries");
}

// Filtering logic
function getFilteredData() {
  const year = +d3.select("#yearSlider").property("value");
  const genre = d3.select("#genreSelect").property("value");
  const rating = d3.select("#ratingSelect").property("value");

  let filtered = allData.filter(d => +d.release_year === year);

  if (genre && genre !== "All genres") {
    filtered = filtered.filter(d => parseGenres(d.listed_in).includes(genre));
  }

  if (rating && rating !== "All ratings") {
    filtered = filtered.filter(d => d.rating === rating);
  }

  if (selectedCountry) {
    filtered = filtered.filter(d => parseCountries(d.country).includes(selectedCountry));
  }

  if (selectedType) {
    filtered = filtered.filter(d => d.type === selectedType);
  }

  if (selectedDirector) {
    filtered = filtered.filter(d => (d.director || "").includes(selectedDirector));
  }

  return filtered;
}

// KPIs
function updateKPIs(data) {
  const total = data.length;
  const movies = data.filter(d => d.type === "Movie").length;
  const tv = data.filter(d => d.type === "TV Show").length;

  // Avg movie duration (minutes)
  const movieMinutes = data
    .filter(d => d.type === "Movie" && d.duration && d.duration.includes("min"))
    .map(d => +d.duration.replace(" min", ""))
    .filter(n => !isNaN(n));

  const avgMovieDuration = movieMinutes.length ? Math.round(d3.mean(movieMinutes)) : null;

  // Avg TV seasons
  const tvSeasons = data
    .filter(d => d.type === "TV Show" && d.duration && d.duration.includes("Season"))
    .map(d => +d.duration.split(" ")[0])
    .filter(n => !isNaN(n));

  const avgTVSeasons = tvSeasons.length ? (d3.mean(tvSeasons)).toFixed(1) : null;

  d3.select("#kpi-total-titles").text(total);
  d3.select("#kpi-movies").text(movies);
  d3.select("#kpi-tv-shows").text(tv);
  d3.select("#kpi-avg-movie-duration").text(avgMovieDuration ? `${avgMovieDuration} min` : "–");
  d3.select("#kpi-avg-tv-seasons").text(avgTVSeasons ? `${avgTVSeasons}` : "–");
}

// Update all charts
function updateAll() {
  const filtered = getFilteredData();

  updateKPIs(filtered);
  drawMap(filtered);
  drawTypePie(filtered);
  drawYearTrend(filtered);
  drawTopDirectors(filtered);
  drawDurations(filtered);
}

// MAP
function drawMap(filteredData) {
  const MAP_INNER_W = 760;
  const MAP_INNER_H = 340;

  const { g, width, height } = createSvg(
    "#map",
    MAP_INNER_W + margin.left + margin.right,
    MAP_INNER_H + margin.top + margin.bottom,
    margin
  );

  if (!worldGeo) return;

  const projection = d3.geoMercator()
    .fitSize([width, height], worldGeo)
    .scale(130)
    .translate([width / 2, height / 1.5]);

  const path = d3.geoPath().projection(projection);

  g.selectAll("path.country")
    .data(worldGeo.features)
    .enter()
    .append("path")
    .attr("class", "country")
    .attr("d", path);

  const exploded = [];
  filteredData.forEach(d => {
    parseCountries(d.country).forEach(c => exploded.push({ country: c }));
  });

  if (!exploded.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted)
      .text("No country data for current filters.");
    return;
  }

  const countsArr = d3.rollups(exploded, v => v.length, d => d.country);
  const countsMap = new Map(countsArr.map(([c, n]) => [c, n]));
  const maxCount = d3.max(countsArr, d => d[1]) || 1;

  const circleScale = d3.scaleSqrt()
    .domain([0, maxCount])
    .range([6, 32]);

  const bubbleData = worldGeo.features
    .map(feat => {
      const name = feat.properties && (feat.properties.name || feat.properties.NAME);
      if (!name) return null;

      const count = countsMap.get(name);
      if (!count) return null;

      const centroid = path.centroid(feat);
      if (!centroid || centroid.some(isNaN)) return null;

      return { name, count, x: centroid[0], y: centroid[1] };
    })
    .filter(Boolean);

  if (!bubbleData.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted)
      .text("No country data for current filters.");
    return;
  }

  bubbleData.forEach(d => {
    d.x += Math.random() * 12 - 6;
    d.y += Math.random() * 12 - 6;
  });

  g.selectAll("circle.bubble")
    .data(bubbleData)
    .enter()
    .append("circle")
    .attr("class", "bubble")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", d => circleScale(d.count))
    .attr("fill", d => selectedCountry === d.name ? COLORS.select : COLORS.green)
    .attr("fill-opacity", 0.9)
    .attr("stroke", COLORS.white)
    .attr("stroke-width", d => selectedCountry === d.name ? 5 : 2)
    .style("cursor", "pointer")
    .on("mouseover", function () {
      d3.select(this).attr("stroke", COLORS.orange).attr("stroke-width", 6);
    })
    .on("mouseout", function (event, d) {
      d3.select(this)
        .attr("stroke", COLORS.white)
        .attr("stroke-width", selectedCountry === d.name ? 5 : 2);
    })
    .on("click", (event, d) => {
      selectedCountry = selectedCountry === d.name ? null : d.name;
      d3.select("#countryLabel").text(selectedCountry || "All countries");
      updateAll();
    })
    .append("title")
    .text(d => `${d.name}: ${d.count} titles`);

  g.selectAll("text.country-label")
    .data(bubbleData)
    .enter()
    .append("text")
    .attr("class", "country-label")
    .attr("x", d => d.x)
    .attr("y", d => d.y + 5)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("font-weight", "bold")
    .attr("fill", COLORS.white)
    .attr("stroke", COLORS.black)
    .attr("stroke-width", 3)
    .attr("paint-order", "stroke fill")
    .style("pointer-events", "none")
    .text(d => d.name);
}

// -------- Top Directors --------
function drawTopDirectors(data) {
  const { g, width, height } = createSvg("#topDirectors", 760, 420);

  const directors = data
    .map(d => d.director)
    .filter(Boolean)
    .flatMap(d => d.split(",").map(x => x.trim()))
    .filter(Boolean);

  if (!directors.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted)
      .text("No director data for current filters.");
    return;
  }

  const grouped = d3.rollups(directors, v => v.length, d => d)
    .map(([director, count]) => ({ director, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const y = d3.scaleBand().domain(grouped.map(d => d.director)).range([0, height]).padding(0.15);
  const x = d3.scaleLinear().domain([0, d3.max(grouped, d => d.count)]).range([0, width]);

  g.selectAll("rect")
    .data(grouped)
    .enter()
    .append("rect")
    .attr("class", "rect")
    .attr("y", d => y(d.director))
    .attr("height", y.bandwidth())
    .attr("x", 0)
    .attr("width", d => x(d.count))
    .attr("fill", d => selectedDirector === d.director ? COLORS.select : COLORS.primary)
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      selectedDirector = selectedDirector === d.director ? null : d.director;
      updateAll();
    })
    .append("title")
    .text(d => `${d.director}: ${d.count}`);

  g.selectAll(".director-label")
    .data(grouped)
    .enter()
    .append("text")
    .attr("class", "director-label")
    .attr("x", 8)
    .attr("y", d => y(d.director) + y.bandwidth() / 2 + 4)
    .text(d => d.director);

  const xAxis = d3.axisBottom(x).ticks(4).tickSizeOuter(0);
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height})`)
    .call(xAxis);

  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 32)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.text)
    .attr("font-size", "12px")
    .text("Number of Titles");
}

// -------- Durations --------
function drawDurations(data) {
  const container = d3.select("#durations");
  container.selectAll("*").remove();

  const w = 430, h = 300;

  const svg = container.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${w} ${h}`);

  // Two charts side-by-side
  const left = { x: 35, y: 35, w: 190, h: 220 };
  const right = { x: 245, y: 35, w: 170, h: 220 };

  // Movies minutes
  const movieMinutes = data
    .filter(d => d.type === "Movie" && d.duration && d.duration.includes("min"))
    .map(d => +d.duration.replace(" min", ""))
    .filter(n => !isNaN(n));

  // TV seasons
  const tvSeasons = data
    .filter(d => d.type === "TV Show" && d.duration && d.duration.includes("Season"))
    .map(d => +d.duration.split(" ")[0])
    .filter(n => !isNaN(n));

  // Movie histogram
  if (movieMinutes.length) {
    const x = d3.scaleLinear()
      .domain(d3.extent(movieMinutes))
      .nice()
      .range([left.x, left.x + left.w]);

    const bins = d3.bin()
      .domain(x.domain())
      .thresholds(10)(movieMinutes);

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length)])
      .nice()
      .range([left.y + left.h, left.y]);

    svg.selectAll("rect.movie")
      .data(bins)
      .enter()
      .append("rect")
      .attr("class", "movie")
      .attr("x", d => x(d.x0) + 1)
      .attr("y", d => y(d.length))
      .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr("height", d => (left.y + left.h) - y(d.length))
      .attr("fill", COLORS.primary)
      .attr("opacity", 0.9);

    const xAxis = d3.axisBottom(x).ticks(4);
    const yAxis = d3.axisLeft(y).ticks(3);

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0, ${left.y + left.h})`)
      .call(xAxis);

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${left.x},0)`)
      .call(yAxis);

    svg.append("text")
      .attr("x", left.x + left.w / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.primary)
      .attr("font-weight", 700)
      .text("Movies (minutes)");
  } else {
    svg.append("text")
      .attr("x", left.x + left.w / 2)
      .attr("y", left.y + left.h / 2)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted)
      .text("No movie duration data");
  }

  // TV histogram
  if (tvSeasons.length) {
    const x = d3.scaleLinear()
      .domain([1, d3.max(tvSeasons)])
      .nice()
      .range([right.x, right.x + right.w]);

    const bins = d3.bin()
      .domain(x.domain())
      .thresholds(d3.range(1, d3.max(tvSeasons) + 1))(tvSeasons);

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length)])
      .nice()
      .range([right.y + right.h, right.y]);

    svg.selectAll("rect.tv")
      .data(bins)
      .enter()
      .append("rect")
      .attr("class", "tv")
      .attr("x", d => x(d.x0) + 1)
      .attr("y", d => y(d.length))
      .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr("height", d => (right.y + right.h) - y(d.length))
      .attr("fill", COLORS.orange)
      .attr("opacity", 0.9);

    const xAxis = d3.axisBottom(x).ticks(4).tickFormat(d3.format("d"));
    const yAxis = d3.axisRight(y).ticks(3);

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0, ${right.y + right.h})`)
      .call(xAxis);

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${right.x + right.w},0)`)
      .call(yAxis);

    svg.append("text")
      .attr("x", right.x + right.w / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.orange)
      .attr("font-weight", 700)
      .text("TV Shows (seasons)");
  } else {
    svg.append("text")
      .attr("x", right.x + right.w / 2)
      .attr("y", right.y + right.h / 2)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted)
      .text("No TV duration data");
  }

  // ---- Axis labels ----
  // Movies X-axis
  svg.append("text")
    .attr("x", left.x + left.w / 2)
    .attr("y", h - 6)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.text)
    .attr("font-size", "11px")
    .text("Duration (minutes)");

  // Movies Y-axis
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -(left.y + left.h / 2))
    .attr("y", 14)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.text)
    .attr("font-size", "11px")
    .text("Count");

  // TV Shows X-axis
  svg.append("text")
    .attr("x", right.x + right.w / 2)
    .attr("y", h - 6)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.text)
    .attr("font-size", "11px")
    .text("Number of Seasons");

  // TV Shows Y-axis
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -(right.y + right.h / 2))
    .attr("y", right.x + right.w + 32)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.text)
    .attr("font-size", "11px")
    .text("Count");
}

// Pie: Type distribution
function drawTypePie(data) {
  const { g, width, height } = createSvg("#typePie", 430, 300);

  if (!data.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted)
      .text("No data for current filters.");
    return;
  }

  const counts = d3.rollups(data, v => v.length, d => d.type);
  const total = d3.sum(counts, d => d[1]);

  const pieData = counts.map(([type, count]) => ({ type, count }));

  const radius = Math.min(width, height) / 2 - 6;

  const pie = d3.pie()
    .sort(null)
    .value(d => d.count);

  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius);

  const color = d3.scaleOrdinal()
    .domain(["Movie", "TV Show"])
    .range([COLORS.primary, COLORS.orange]);

  const center = g.append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const typeMap = { Movie: "Movie", "TV Show": "TV Show" };

  center.selectAll("path")
    .data(pie(pieData))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("stroke", COLORS.white)
    .attr("stroke-width", 2)
    .attr("fill", d => selectedType === typeMap[d.data.type] ? COLORS.select : color(d.data.type))
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      const t = typeMap[d.data.type];
      selectedType = selectedType === t ? null : t;
      updateAll();
    })
    .append("title")
    .text(d => `${d.data.type}: ${d.data.count}`);

  center.append("text")
    .attr("y", -radius - 10)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.text)
    .attr("font-weight", 700)
    .text(`Total Titles: ${total}`);

  const legend = g.append("g")
    .attr("transform", `translate(${width - 60}, 40)`);

  const legendItems = ["Movie", "TV Show"];

  legend.selectAll("rect")
    .data(legendItems)
    .enter()
    .append("rect")
    .attr("x", 0)
    .attr("y", (d, i) => i * 22)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => color(d));

  legend.selectAll("text")
    .data(legendItems)
    .enter()
    .append("text")
    .attr("x", 18)
    .attr("y", (d, i) => i * 22 + 10)
    .attr("fill", COLORS.text)
    .attr("font-size", "12px")
    .text(d => {
      const found = pieData.find(x => x.type === d);
      return `${d}: ${found ? found.count : 0}`;
    });
}

// Trend: Titles released over years
function drawYearTrend(data) {
  const { g, width, height } = createSvg("#yearTrend", 430, 300);

  const genre = d3.select("#genreSelect").property("value");
  const rating = d3.select("#ratingSelect").property("value");

  let filtered = allData.slice();

  if (genre && genre !== "All genres") {
    filtered = filtered.filter(d => parseGenres(d.listed_in).includes(genre));
  }
  if (rating && rating !== "All ratings") {
    filtered = filtered.filter(d => d.rating === rating);
  }
  if (selectedCountry) {
    filtered = filtered.filter(d => parseCountries(d.country).includes(selectedCountry));
  }
  if (selectedType) {
    filtered = filtered.filter(d => d.type === selectedType);
  }
  if (selectedDirector) {
    filtered = filtered.filter(d => (d.director || "").includes(selectedDirector));
  }

  const rolled = d3.rollups(
    filtered,
    v => v.length,
    d => +d.release_year
  )
    .map(([year, count]) => ({ year, count }))
    .filter(d => !isNaN(d.year))
    .sort((a, b) => a.year - b.year);

  if (!rolled.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted)
      .text("No trend data for current filters.");
    return;
  }

  const x = d3.scaleLinear()
    .domain(d3.extent(rolled, d => d.year))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rolled, d => d.count)])
    .nice()
    .range([height, 0]);

  const area = d3.area()
    .x(d => x(d.year))
    .y0(height)
    .y1(d => y(d.count));

  g.append("path")
    .datum(rolled)
    .attr("fill", COLORS.green)
    .attr("opacity", 0.18)
    .attr("d", area);

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.count));

  g.append("path")
    .datum(rolled)
    .attr("fill", "none")
    .attr("stroke", COLORS.green)
    .attr("stroke-width", 3)
    .attr("d", line);

  g.selectAll("circle")
    .data(rolled)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.count))
    .attr("r", 3.5)
    .attr("fill", COLORS.green)
    .append("title")
    .text(d => `${d.year}: ${d.count}`);

  const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d3.format("d"));
  const yAxis = d3.axisLeft(y).ticks(5);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height})`)
    .call(xAxis);

  g.append("g")
    .attr("class", "axis")
    .call(yAxis);

  // ✅ Axis labels MUST be inside the function (so g/width/height exist)
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 38)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.text)
    .attr("font-size", "12px")
    .text("Release Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -38)
    .attr("text-anchor", "middle")
    .attr("fill", COLORS.text)
    .attr("font-size", "12px")
    .text("Number of Titles");
}

// Load data + start
Promise.all([
  d3.csv(DATA_PATH),
  d3.json(WORLD_GEO_PATH)
]).then(([csvData, geo]) => {
  allData = csvData;
  worldGeo = geo;

  initFilters(allData);
  updateAll();
}).catch(err => {
  console.error("Error loading data:", err);
});
