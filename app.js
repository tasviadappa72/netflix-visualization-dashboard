// -------- Paths (local files) --------
const DATA_PATH = "data/Netflix_Dataset.csv";
const WORLD_GEO_PATH = "data/world.geojson";

// -------- Layout helpers --------
const margin = { top: 20, right: 20, bottom: 35, left: 45 };
const defaultWidth = 430;
const defaultHeight = 240;
let allData = [];
let worldGeo = null;
let selectedCountry = null;
let selectedType = null;
let selectedDirector = null;

// -------- SVG helper --------
function createSvg(containerSelector, width = defaultWidth, height = defaultHeight) {
  d3.select(containerSelector).selectAll("*").remove();
  const svg = d3.select(containerSelector)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  return { svg, g, width, height };
}

// -------- Helpers --------
function parseCountries(str) {
  if (!str) return [];
  return str.split(",").map(s => s.trim()).filter(Boolean);
}
function parseGenres(str) {
  if (!str) return [];
  return str.split(",").map(s => s.trim()).filter(Boolean);
}

// -------- Load data --------
Promise.all([
  d3.csv(DATA_PATH),
  d3.json(WORLD_GEO_PATH)
]).then(([rows, geo]) => {
  worldGeo = geo;
  allData = rows.map(d => ({
    show_id: d.show_id,
    type: d.type,
    title: d.title,
    director: d.director || "",
    cast: d.cast || "",
    country: d.country || "",
    date_added: d.date_added || "",
    release_year: d.release_year ? +d.release_year : null,
    rating: d.rating || "Unknown",
    duration: d.duration || "",
    listed_in: d.listed_in || "",
    description: d.description || ""
  })).filter(d => d.title && d.type && d.release_year);

  console.log("Data loaded successfully! Total rows:", allData.length);
  initFilters(allData);
  updateAll();
}).catch(err => {
  console.error("Error loading data:", err);
  alert("Data load failed. Check console (F12).");
});

// -------- Filters --------
function initFilters(data) {
  const filteredData = data.filter(d => d.release_year >= 1980);
  const years = filteredData.map(d => d.release_year).filter(y => y);
  const minYear = d3.min(years);
  const maxYear = d3.max(years);

  const yearSlider = d3.select("#yearSlider")
    .attr("min", minYear)
    .attr("max", maxYear)
    .attr("value", minYear)
    .attr("step", 1);

  d3.select("#yearLabel").text(minYear);

  yearSlider.on("input", () => {
    const val = yearSlider.property("value");
    d3.select("#yearLabel").text(val);
    updateAll();
  });

  const allGenres = new Set();
  filteredData.forEach(d => parseGenres(d.listed_in).forEach(g => allGenres.add(g)));
  const sortedGenres = Array.from(allGenres).sort();

  const genreSelect = d3.select("#genreSelect");
  genreSelect.selectAll("*").remove();
  genreSelect.append("option").attr("value", "All").text("All genres");
  genreSelect.selectAll("option").data(sortedGenres).enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);
  genreSelect.on("change", updateAll);

  const allRatings = Array.from(new Set(filteredData.map(d => d.rating || "Unknown"))).sort();
  const ratingSelect = d3.select("#ratingSelect");
  ratingSelect.selectAll("*").remove();
  ratingSelect.append("option").attr("value", "All").text("All ratings");
  ratingSelect.selectAll("option").data(allRatings).enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);
  ratingSelect.on("change", updateAll);

  d3.select("#countryLabel").text("All countries");
}

// -------- Get filtered data --------
function getFilteredData() {
  const selectedYear = +d3.select("#yearSlider").property("value");
  const selectedGenre = d3.select("#genreSelect").property("value");
  const selectedRating = d3.select("#ratingSelect").property("value");

  let filtered = allData.filter(d => d.release_year === selectedYear);

  if (selectedGenre && selectedGenre !== "All") {
    filtered = filtered.filter(d => parseGenres(d.listed_in).includes(selectedGenre));
  }
  if (selectedRating && selectedRating !== "All") {
    filtered = filtered.filter(d => d.rating === selectedRating);
  }
  if (selectedCountry) {
    filtered = filtered.filter(d => parseCountries(d.country).includes(selectedCountry));
  }
  if (selectedType) {
    filtered = filtered.filter(d => d.type === selectedType);
  }
  if (selectedDirector) {
    filtered = filtered.filter(d =>
      d.director && d.director.split(",").map(x => x.trim()).includes(selectedDirector)
    );
  }
  return filtered;
}

// -------- KPIs --------
function updateKPIs(data) {
  if (!data || data.length === 0) {
    d3.select("#kpi-total-titles").text("0");
    d3.select("#kpi-movies").text("0");
    d3.select("#kpi-tv-shows").text("0");
    d3.select("#kpi-avg-movie-duration").text("–");
    d3.select("#kpi-avg-tv-seasons").text("–");
    return;
  }

  const total = data.length;
  const movies = data.filter(d => d.type === "Movie");
  const tvShows = data.filter(d => d.type === "TV Show");

  const movieDurations = movies
    .map(d => {
      const match = d.duration.match(/(\d+) min/);
      return match ? +match[1] : null;
    })
    .filter(v => v !== null);
  const avgMovie = movieDurations.length > 0 ? Math.round(d3.mean(movieDurations)) : 0;

  const tvSeasons = tvShows
    .map(d => {
      const match = d.duration.match(/(\d+) Season/);
      return match ? +match[1] : null;
    })
    .filter(v => v !== null);
  const avgTV = tvSeasons.length > 0 ? d3.mean(tvSeasons).toFixed(1) : 0;

  d3.select("#kpi-total-titles").text(total);
  d3.select("#kpi-movies").text(movies.length);
  d3.select("#kpi-tv-shows").text(tvShows.length);
  d3.select("#kpi-avg-movie-duration").text(avgMovie ? `${avgMovie} min` : "–");
  d3.select("#kpi-avg-tv-seasons").text(avgTV || "–");
}

// -------- Master update --------
function updateAll() {
  const filtered = getFilteredData();
  updateKPIs(filtered);
  drawMap(filtered);
  drawTopDirectors(filtered);
  drawDurations(filtered);
  drawTypePie(filtered);
  drawYearTrend(allData);
}

// -------- World Map --------
function drawMap(data) {
  const { g, width, height } = createSvg("#map", 760, 340);
  if (!worldGeo) return;

  const exploded = [];
  data.forEach(d => {
    const countries = parseCountries(d.country);
    countries.forEach(c => exploded.push({ country: c }));
  });

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

  if (!exploded.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .text("No country data for current filters.");
    return;
  }

  const countsArr = d3.rollups(exploded, v => v.length, d => d.country);
  const countsMap = new Map(countsArr.map(([c, n]) => [c, n]));
  const maxCount = d3.max(countsArr, d => d[1]);
  const circleScale = d3.scaleSqrt().domain([0, maxCount]).range([6, 32]);

  const bubbleData = worldGeo.features
    .map(feat => {
      const name = feat.properties.name;
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
      .attr("fill", "#94a3b8")
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
    .attr("fill", d => selectedCountry === d.name ? "#90cdf4" : "#648fff")
    .attr("fill-opacity", 0.9)
    .attr("stroke", "#fff")
    .attr("stroke-width", d => selectedCountry === d.name ? 5 : 2)
    .style("cursor", "pointer")
    .on("mouseover", function () {
      d3.select(this).attr("stroke", "#90cdf4").attr("stroke-width", 6);
    })
    .on("mouseout", function (event, d) {
      d3.select(this).attr("stroke", "#fff")
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
    .attr("fill", "#ffffff")
    .attr("stroke", "#000")
    .attr("stroke-width", 3)
    .attr("paint-order", "stroke fill")
    .style("pointer-events", "none")
    .text(d => d.name);
}

// -------- Top Directors --------
function drawTopDirectors(data) {
  const { g, width, height } = createSvg("#topDirectors");
  const directors = data
    .filter(d => d.director)
    .flatMap(d => d.director.split(",").map(x => x.trim()))
    .filter(Boolean);

  if (!directors.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .text("No director data for current filters.");
    return;
  }

  const grouped = d3.rollups(directors, v => v.length, d => d)
    .map(([director, count]) => ({ director, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const y = d3.scaleBand().domain(grouped.map(d => d.director)).range([0, height]).padding(0.15);
  const x = d3.scaleLinear().domain([0, d3.max(grouped, d => d.count)]).nice().range([0, width]);

  g.selectAll("rect")
    .data(grouped)
    .enter()
    .append("rect")
    .attr("y", d => y(d.director))
    .attr("x", 0)
    .attr("height", y.bandwidth())
    .attr("width", d => x(d.count))
    .attr("fill", d => selectedDirector === d.director ? "#90cdf4" : "#648fff")
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      selectedDirector = selectedDirector === d.director ? null : d.director;
      updateAll();
    })
    .append("title")
    .text(d => `${d.director}\nTitles: ${d.count}`);

  g.selectAll("text.director-label")
    .data(grouped)
    .enter()
    .append("text")
    .attr("x", 4)
    .attr("y", d => y(d.director) + y.bandwidth() / 2 + 3)
    .text(d => d.director);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5));
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 30)
    .attr("text-anchor", "middle")
    .attr("fill", "#e2e8f0")
    .attr("font-size", "12px")
    .text("Number of Titles");
}

// -------- Durations --------
function drawDurations(data) {
  const { g, width, height } = createSvg("#durations");
  const movieDurations = data
    .filter(d => d.type === "Movie" && d.duration && d.duration.includes("min"))
    .map(d => +d.duration.match(/(\d+) min/)[1])
    .filter(v => !isNaN(v));
  const tvDurations = data
    .filter(d => d.type === "TV Show" && d.duration)
    .map(d => +d.duration.match(/(\d+) Season/)[1])
    .filter(v => !isNaN(v));

  if (!movieDurations.length && !tvDurations.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .text("No duration data for current filters.");
    return;
  }

  const widthHalf = width / 2 - 20;
  const maxCount = Math.max(
    movieDurations.length ? d3.max(d3.bin()(movieDurations).map(b => b.length)) : 0,
    tvDurations.length ? d3.max(d3.rollups(tvDurations, v => v.length, d => d).map(d => d[1])) : 0
  );

  if (movieDurations.length) {
    const xM = d3.scaleLinear().domain(d3.extent(movieDurations)).nice().range([0, widthHalf]);
    const yM = d3.scaleLinear().domain([0, maxCount]).range([height, 0]);
    const bins = d3.bin().thresholds(10)(movieDurations);
    const movieGroup = g.append("g");
    movieGroup.selectAll("rect")
      .data(bins)
      .enter()
      .append("rect")
      .attr("x", d => xM(d.x0))
      .attr("y", d => yM(d.length))
      .attr("width", d => Math.max(0, xM(d.x1) - xM(d.x0) - 1))
      .attr("height", d => height - yM(d.length))
      .attr("fill", "#648fff")
      .append("title")
      .text(d => `${d.x0}–${d.x1} min: ${d.length}`);
    movieGroup.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xM).ticks(5));
    movieGroup.append("g").attr("class", "axis").call(d3.axisLeft(yM).ticks(4));
    movieGroup.append("text")
      .attr("x", widthHalf / 2)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", "#90cdf4")
      .text("Movies (minutes)");
  }

  if (tvDurations.length) {
    const tvCounts = d3.rollups(tvDurations, v => v.length, d => d)
      .map(([seasons, count]) => ({ seasons, count }))
      .sort((a, b) => a.seasons - b.seasons);
    const xT = d3.scaleBand().domain(tvCounts.map(d => d.seasons)).range([widthHalf + 40, width]).padding(0.2);
    const yT = d3.scaleLinear().domain([0, maxCount]).range([height, 0]);
    const tvGroup = g.append("g");
    tvGroup.selectAll("rect")
      .data(tvCounts)
      .enter()
      .append("rect")
      .attr("x", d => xT(d.seasons))
      .attr("y", d => yT(d.count))
      .attr("width", xT.bandwidth())
      .attr("height", d => height - yT(d.count))
      .attr("fill", "#fb923c")
      .append("title")
      .text(d => `${d.seasons} season(s): ${d.count}`);
    tvGroup.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xT));
    tvGroup.append("g").attr("class", "axis").attr("transform", `translate(${width},0)`).call(d3.axisRight(yT).ticks(4));
    tvGroup.append("text")
      .attr("x", widthHalf + (width - widthHalf) / 2 + 20)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", "#fb923c")
      .text("TV Shows (seasons)");
  }
}

// -------- Pie Chart --------
function drawTypePie(data) {
  const { g, width, height } = createSvg("#typePie", 300, 280);
  if (!data.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .text("No data");
    return;
  }

  const movies = data.filter(d => d.type === "Movie").length;
  const tvShows = data.filter(d => d.type === "TV Show").length;
  const pieData = [
    { label: "Movies", value: movies },
    { label: "TV Shows", value: tvShows }
  ].filter(d => d.value > 0);

  const radius = Math.min(width, height) / 2 - 30;
  const centerX = width / 2 - 40;
  const centerY = height / 2 + 10;

  const pie = d3.pie().value(d => d.value);
  const arc = d3.arc().innerRadius(0).outerRadius(radius);

  const color = d3.scaleOrdinal()
    .domain(pieData.map(d => d.label))
    .range(["#648fff", "#fb923c"]);  // Soft blue for Movies, Orange for TV Shows

  const pieGroup = g.append("g").attr("transform", `translate(${centerX},${centerY})`);
  const typeMap = { "Movies": "Movie", "TV Shows": "TV Show" };

  const arcs = pieGroup.selectAll("g.arc")
    .data(pie(pieData))
    .enter()
    .append("g")
    .attr("class", "arc");

  arcs.append("path")
    .attr("d", arc)
    .attr("fill", d => selectedType === typeMap[d.data.label] ? "#90cdf4" : color(d.data.label))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      const t = typeMap[d.data.label];
      selectedType = selectedType === t ? null : t;
      updateAll();
    })
    .append("title")
    .text(d => `${d.data.label}: ${d.data.value} (${((d.data.value / data.length) * 100).toFixed(1)}%)`);

  g.append("text")
    .attr("x", centerX)
    .attr("y", centerY - radius - 12)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .attr("font-weight", "bold")
    .attr("fill", "#ffffff")
    .text(`Total Titles: ${data.length}`);

  const legend = g.append("g")
    .attr("transform", `translate(${centerX + radius + 25}, ${centerY - 20})`);
  pieData.forEach((d, i) => {
    legend.append("rect")
      .attr("x", 0)
      .attr("y", i * 22)
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", color(d.label));
    legend.append("text")
      .attr("x", 20)
      .attr("y", i * 22 + 11)
      .attr("font-size", "12px")
      .attr("fill", "#e5e7eb")
      .text(`${d.label}: ${d.value}`);
  });
}

// -------- Year Trend --------
function drawYearTrend(data) {
  const { g, width, height } = createSvg("#yearTrend", 500, 280);
  const trendData = d3.rollups(
    data.filter(d => d.release_year >= 1970),
    v => v.length,
    d => d.release_year
  )
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  if (trendData.length === 0) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .text("No data");
    return;
  }

  const x = d3.scaleLinear().domain(d3.extent(trendData, d => d.year)).range([0, width]);
  const y = d3.scaleLinear().domain([0, d3.max(trendData, d => d.count)]).nice().range([height, 0]);

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.count))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(trendData)
    .attr("fill", "none")
    .attr("stroke", "#648fff")
    .attr("stroke-width", 3)
    .attr("d", line);

  g.append("path")
    .datum(trendData)
    .attr("fill", "#648fff")
    .attr("fill-opacity", 0.2)
    .attr("d", d3.area()
      .x(d => x(d.year))
      .y0(height)
      .y1(d => y(d.count))
      .curve(d3.curveMonotoneX));

  g.selectAll("circle")
    .data(trendData)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.count))
    .attr("r", 4)
    .attr("fill", "#648fff")
    .append("title")
    .text(d => `${d.year}: ${d.count} titles`);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y));
}
