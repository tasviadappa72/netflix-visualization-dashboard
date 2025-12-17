# Netflix Explorer Dashboard (D3.js)

An interactive data visualization dashboard built with **D3.js** to explore Netflix titles by **year, genre, rating, country**, and more. The dashboard includes a world map bubble chart, type distribution pie chart, release-year trend line/area chart, top directors bar chart, and duration histograms.

---

## Features
- **Year slider** to view titles released in a selected year  
- **Genre** and **Rating** dropdown filters  
- **Interactive world map** with country bubbles  
  - Click a bubble to filter the entire dashboard by country  
- **Movies vs TV Shows** pie chart (click slices to filter)  
- **Titles Released Over Years** trend chart (based on current filters)  
- **Top 10 Directors** bar chart (click bars to filter)  
- **Durations** panel with side-by-side histograms  
  - Movie duration (minutes)  
  - TV show seasons (count)  

---

## Tech Stack
- **HTML / CSS**
- **JavaScript**
- **D3.js v7**
- **TopoJSON Client** (optional, if needed for map utilities)

---

## Project Structure
'''text
project-folder/
│── index.html
│── styles.css
│── app.js
└── data/
    │── Netflix_Dataset.csv
    └── world.geojson
# netflix-visualization-dashboard
Interactive Netflix analytics dashboard built with D3.js, showing content by country, rating, genre, type, and year using a merged Netflix + IMDb dataset.


## Dataset Requirements
Your `Netflix_Dataset.csv` should include (at minimum) the following columns:
- `type` (Movie / TV Show)
- `title`
- `director`
- `country` (comma-separated list)
- `listed_in` (genres, comma-separated)
- `rating`
- `release_year`
- `duration` (e.g., `"90 min"` or `"2 Seasons"`)

---

## How to Run (Recommended)
Because the dashboard loads local CSV and GeoJSON files, you must run it using a local server. Opening the HTML file directly may block file loading due to browser security restrictions.

### Option A: VS Code Live Server
1. Open the project folder in VS Code  
2. Install the **Live Server** extension  
3. Right-click `index.html` → **Open with Live Server**

### Option B: Python HTTP Server
From the project folder, run:
```bash
python3 -m http.server 8000

Then open:
'''text
http://localhost:8000

### Option C: Node – http-server

Make sure Node.js is installed on your system.

npm install -g http-server  
http-server .

Open the URL shown in the terminal (usually http://localhost:8080).


## Usage Guide

- Use the Year slider to select a release year
- Use Genre and Rating dropdowns to narrow results
- Click a country bubble on the map to filter all charts by that country
- Click the same country bubble again to remove the filter
- Click the pie slice (Movie / TV Show) to filter by title type
- Click a director bar to filter by that director
- Refresh the page to reset all filters  
  (or click the same selected item again to unselect)



## Troubleshooting

### Dashboard is blank / data not loading

Open the browser Developer Console.

Safari:
- Safari → Settings / Preferences → Advanced
- Enable “Show Develop menu”
- Develop → Show JavaScript Console

Common causes:
- Not running a local server  
  (use Live Server, Python HTTP server, or Node http-server)
- Incorrect file paths  
  (ensure all data files are inside the /data/ folder)
- JavaScript errors stopping execution  
  (check the console for errors)



### Map shows no bubbles

This usually happens when country names in the dataset do not match the names used in world.geojson.

Example mismatches:
- United States vs United States of America
- Russia vs Russian Federation

Fix:
- Create a small country-name mapping function in app.js if needed


## Credits

- Netflix Titles Dataset
- World GeoJSON: data/world.geojson  
  (Source: Natural Earth / common GeoJSON datasets)





