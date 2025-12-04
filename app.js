// -------- Paths --------
const DATA_PATH = "data/Netflix_Dataset.csv";
const WORLD_GEO_PATH = "data/world.geojson";

// -------- Layout helpers --------
const margin = { top: 20, right: 20, bottom: 35, left: 45 };
const defaultWidth = 430;
const defaultHeight = 240;

let allData = [];
let worldGeo = null;

// Create / clear SVG in container
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

// Helpers
function parseCountries(str) {
  if (!str) return [];
  return str.split(",").map(s => s.trim()).filter(Boolean);
}

function parseGenres(str) {
  if (!str) return [];
  return str.split(",").map(s => s.trim()).filter(Boolean);
}

// A small list of stopwords for title word cloud
const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "in", "on", "to", "for", "at",
  "with", "by", "from", "la", "el", "los", "las", "de", "da",
  "do", "un", "una", "le", "les", "du", "des"
]);

// -------- Load data --------
Promise.all([
  d3.csv(DATA_PATH),
  d3.json(WORLD_GEO_PATH)
]).then(([rows, geo]) => {
  worldGeo = geo;

  allData = rows.map(d => ({
    show_id: d.show_id,
    type: d.type, // "Movie" or "TV Show"
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

  initFilters(allData);
  updateAll();
}).catch(err => {
  console.error("Error loading data:", err);
});

// -------- Filters --------
function initFilters(data) {
  // Year sliders
  const years = data
    .map(d => d.release_year)
    .filter(y => y && !isNaN(y));

  const minYear = d3.min(years);
  const maxYear = d3.max(years);

  const yearMinSlider = d3.select("#yearMinSlider")
    .attr("min", minYear)
    .attr("max", maxYear)
    .attr("value", minYear);

  const yearMaxSlider = d3.select("#yearMaxSlider")
    .attr("min", minYear)
    .attr("max", maxYear)
    .attr("value", maxYear);

  d3.select("#yearMinLabel").text(minYear);
  d3.select("#yearMaxLabel").text(maxYear);

  yearMinSlider.on("input", () => {
    const minVal = +yearMinSlider.property("value");
    let maxVal = +yearMaxSlider.property("value");
    if (minVal > maxVal) {
      maxVal = minVal;
      yearMaxSlider.property("value", maxVal);
    }
    d3.select("#yearMinLabel").text(minVal);
    d3.select("#yearMaxLabel").text(maxVal);
    updateAll();
  });

  yearMaxSlider.on("input", () => {
    let minVal = +yearMinSlider.property("value");
    const maxVal = +yearMaxSlider.property("value");
    if (maxVal < minVal) {
      minVal = maxVal;
      yearMinSlider.property("value", minVal);
    }
    d3.select("#yearMinLabel").text(minVal);
    d3.select("#yearMaxLabel").text(maxVal);
    updateAll();
  });

  // Genres (from listed_in)
  const allGenres = new Set();
  data.forEach(d => {
    parseGenres(d.listed_in).forEach(g => allGenres.add(g));
  });

  const sortedGenres = Array.from(allGenres).sort(d3.ascending);
  const genreSelect = d3.select("#genreSelect");

  genreSelect.selectAll("option")
    .data(sortedGenres)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  genreSelect.on("change", () => {
    updateAll();
  });

  // Ratings (checkboxes)
  const allRatings = Array.from(
    new Set(data.map(d => d.rating || "Unknown"))
  ).sort(d3.ascending);

  const ratingContainer = d3.select("#ratingCheckboxes");

  const ratingDivs = ratingContainer.selectAll("div.rating-pill")
    .data(allRatings)
    .enter()
    .append("div")
    .attr("class", "rating-pill");

  ratingDivs.append("input")
    .attr("type", "checkbox")
    .attr("value", d => d)
    .attr("id", d => `rating-${d.replace(/\W+/g, "_")}`)
    .property("checked", true)
    .on("change", () => updateAll());

  ratingDivs.append("label")
    .attr("for", d => `rating-${d.replace(/\W+/g, "_")}`)
    .text(d => d);
}

// Get filtered data based on current UI filters
function getFilteredData() {
  const yearMin = +d3.select("#yearMinSlider").property("value");
  const yearMax = +d3.select("#yearMaxSlider").property("value");

  const genreSelectNode = document.getElementById("genreSelect");
  const selectedGenres = Array.from(genreSelectNode.selectedOptions).map(o => o.value);

  const checkedRatings = [];
  d3.selectAll("#ratingCheckboxes input:checked").each(function () {
    checkedRatings.push(this.value);
  });

  let filtered = allData.filter(d =>
    d.release_year >= yearMin &&
    d.release_year <= yearMax
  );

  if (selectedGenres.length > 0) {
    filtered = filtered.filter(d => {
      const rowGenres = parseGenres(d.listed_in);
      return rowGenres.some(g => selectedGenres.includes(g));
    });
  }

  if (checkedRatings.length > 0) {
    filtered = filtered.filter(d => checkedRatings.includes(d.rating));
  }

  return filtered;
}

// Master update function
function updateAll() {
  const filtered = getFilteredData();
  drawWordCloud(filtered);
  drawMap(filtered);
  drawTopDirectors(filtered);
  drawDurations(filtered);
}

// -------- 1) Word cloud of title words --------
function drawWordCloud(data) {
  const container = "#wordCloud";
  d3.select(container).selectAll("*").remove();

  const width = 240;
  const height = 140;

  if (!data.length) {
    d3.select(container)
      .append("div")
      .style("font-size", "11px")
      .style("color", "#d4d4d4")
      .text("No titles for current filters.");
    return;
  }

  // Build word frequencies from titles
  const freqMap = new Map();

  data.forEach(d => {
    const words = d.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w && !STOPWORDS.has(w));

    words.forEach(w => {
      freqMap.set(w, (freqMap.get(w) || 0) + 1);
    });
  });

  let wordsArray = Array.from(freqMap, ([text, count]) => ({ text, count }));
  wordsArray.sort((a, b) => d3.descending(a.count, b.count));
  wordsArray = wordsArray.slice(0, 60); // top 60 words

  const counts = wordsArray.map(d => d.count);
  const sizeScale = d3.scaleLinear()
    .domain([d3.min(counts), d3.max(counts)])
    .range([10, 26]);

  const layout = d3.layout.cloud()
    .size([width, height])
    .words(wordsArray.map(d => ({
      text: d.text,
      size: sizeScale(d.count)
    })))
    .padding(2)
    .rotate(() => 0)
    .font("system-ui")
    .fontSize(d => d.size)
    .on("end", draw);

  layout.start();

  function draw(words) {
    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    svg.append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`)
      .selectAll("text")
      .data(words)
      .enter()
      .append("text")
      .style("font-size", d => `${d.size}px`)
      .style("fill", "#ef4444")
      .attr("text-anchor", "middle")
      .attr("transform", d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
      .text(d => d.text);
  }
}

// -------- 2) World map with bubbles by country --------
function drawMap(data) {
  const { svg, g, width, height } = createSvg("#map", 650, 300);

  if (!worldGeo) return;

  const exploded = [];
  data.forEach(d => {
    const countries = parseCountries(d.country);
    if (!countries.length) return;
    countries.forEach(c => exploded.push({ country: c }));
  });

  if (!exploded.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#d4d4d4")
      .text("No country data for current filters.");
    return;
  }

  const countsArr = d3.rollups(
    exploded,
    v => v.length,
    d => d.country
  ).map(([country, count]) => ({ country, count }));

  const countsMap = new Map(countsArr.map(d => [d.country, d.count]));
  const allCounts = countsArr.map(d => d.count);

  const projection = d3.geoMercator()
    .fitSize([width, height], worldGeo);

  const path = d3.geoPath().projection(projection);

  g.selectAll("path.country")
    .data(worldGeo.features)
    .enter()
    .append("path")
    .attr("class", "country")
    .attr("d", path)
    .attr("fill", "#111");

  const circleScale = d3.scaleSqrt()
    .domain([d3.min(allCounts), d3.max(allCounts)])
    .range([2, 18]);

  const bubbleData = worldGeo.features
    .map(feat => {
      const name = feat.properties.name;
      const count = countsMap.get(name);
      if (!count) return null;
      const centroid = path.centroid(feat);
      return { name, count, x: centroid[0], y: centroid[1] };
    })
    .filter(Boolean);

  g.selectAll("circle.bubble")
    .data(bubbleData)
    .enter()
    .append("circle")
    .attr("class", "bubble")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", d => circleScale(d.count))
    .attr("fill", "#ef4444")
    .attr("fill-opacity", 0.7)
    .attr("stroke", "#f9fafb")
    .attr("stroke-width", 0.5)
    .append("title")
    .text(d => `${d.name}\nTitles: ${d.count}`);
}

// -------- 3) Top 10 directors --------
function drawTopDirectors(data) {
  const { g, width, height } = createSvg("#topDirectors");

  const directors = data
    .filter(d => d.director && d.director.trim().length > 0)
    .flatMap(d => d.director.split(",").map(x => x.trim()))
    .filter(Boolean);

  if (!directors.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#d4d4d4")
      .text("No director data for current filters.");
    return;
  }

  const grouped = d3.rollups(
    directors,
    v => v.length,
    d => d
  ).map(([director, count]) => ({ director, count }))
    .sort((a, b) => d3.descending(a.count, b.count))
    .slice(0, 10);

  const y = d3.scaleBand()
    .domain(grouped.map(d => d.director))
    .range([0, height])
    .padding(0.15);

  const x = d3.scaleLinear()
    .domain([0, d3.max(grouped, d => d.count)])
    .nice()
    .range([0, width]);

  g.selectAll("rect")
    .data(grouped)
    .enter()
    .append("rect")
    .attr("y", d => y(d.director))
    .attr("x", 0)
    .attr("height", y.bandwidth())
    .attr("width", d => x(d.count))
    .attr("fill", "#ef4444")
    .append("title")
    .text(d => `${d.director}\nTitles: ${d.count}`);

  g.selectAll("text.director-label")
    .data(grouped)
    .enter()
    .append("text")
    .attr("class", "director-label")
    .attr("x", 4)
    .attr("y", d => y(d.director) + y.bandwidth() / 2 + 3)
    .text(d => d.director);

  const xAxis = d3.axisBottom(x).ticks(5);
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis);
}

// -------- 4) Durations: Movies vs TV Shows --------
function drawDurations(data) {
  const { g, width, height } = createSvg("#durations");

  // Movies: parse "90 min"
  const movieDurations = data
    .filter(d => d.type === "Movie" && d.duration && d.duration.toLowerCase().includes("min"))
    .map(d => {
      const match = d.duration.match(/(\d+)/);
      return match ? +match[1] : null;
    })
    .filter(v => v !== null && !isNaN(v));

  // TV: parse "3 Seasons" or "1 Season"
  const tvDurations = data
    .filter(d => d.type === "TV Show" && d.duration)
    .map(d => {
      const match = d.duration.match(/(\d+)/);
      return match ? +match[1] : null;
    })
    .filter(v => v !== null && !isNaN(v));

  if (!movieDurations.length && !tvDurations.length) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#d4d4d4")
      .text("No duration data for current filters.");
    return;
  }

  const movieBins = d3.bin()
    .domain(d3.extent(movieDurations))
    .thresholds(10)(movieDurations);

  const tvCountsArr = d3.rollups(
    tvDurations,
    v => v.length,
    d => d
  ).map(([seasons, count]) => ({ seasons, count }))
    .sort((a, b) => d3.ascending(a.seasons, b.seasons));

  const widthHalf = width / 2 - 20;

  const maxMovieCount = movieBins.length ? d3.max(movieBins, d => d.length) : 0;
  const maxTvCount = tvCountsArr.length ? d3.max(tvCountsArr, d => d.count) : 0;
  const maxCountOverall = Math.max(maxMovieCount, maxTvCount);

  // Movies histogram (left)
  if (movieBins.length) {
    const xM = d3.scaleLinear()
      .domain(d3.extent(movieDurations))
      .nice()
      .range([0, widthHalf]);

    const yM = d3.scaleLinear()
      .domain([0, maxCountOverall])
      .range([height, 0]);

    const movieGroup = g.append("g");

    movieGroup.selectAll("rect.movie-bar")
      .data(movieBins)
      .enter()
      .append("rect")
      .attr("class", "movie-bar")
      .attr("x", d => xM(d.x0))
      .attr("y", d => yM(d.length))
      .attr("width", d => Math.max(0, xM(d.x1) - xM(d.x0) - 1))
      .attr("height", d => height - yM(d.length))
      .attr("fill", "#ef4444")
      .append("title")
      .text(d => `Movies ${d.x0}–${d.x1} min: ${d.length}`);

    const xAxisM = d3.axisBottom(xM).ticks(5);
    const yAxisM = d3.axisLeft(yM).ticks(4);

    movieGroup.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxisM);

    movieGroup.append("g")
      .attr("class", "axis")
      .call(yAxisM);

    movieGroup.append("text")
      .attr("x", widthHalf / 2)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", "#f97373")
      .attr("font-size", 11)
      .text("Movies (minutes)");
  }

  // TV bar chart (right)
  if (tvCountsArr.length) {
    const xT = d3.scaleBand()
      .domain(tvCountsArr.map(d => d.seasons))
      .range([widthHalf + 40, width])
      .padding(0.2);

    const yT = d3.scaleLinear()
      .domain([0, maxCountOverall])
      .range([height, 0]);

    const tvGroup = g.append("g");

    tvGroup.selectAll("rect.tv-bar")
      .data(tvCountsArr)
      .enter()
      .append("rect")
      .attr("class", "tv-bar")
      .attr("x", d => xT(d.seasons))
      .attr("y", d => yT(d.count))
      .attr("width", xT.bandwidth())
      .attr("height", d => height - yT(d.count))
      .attr("fill", "#f97373")
      .append("title")
      .text(d => `TV shows with ${d.seasons} season(s): ${d.count}`);

    const xAxisT = d3.axisBottom(xT);
    const yAxisT = d3.axisRight(yT).ticks(4);

    tvGroup.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxisT);

    tvGroup.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${width},0)`)
      .call(yAxisT);

    tvGroup.append("text")
      .attr("x", widthHalf + (width - widthHalf) / 2 + 20)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", "#f97373")
      .attr("font-size", 11)
      .text("TV Shows (seasons)");
  }
}
