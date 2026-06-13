# American Choice

A static, responsive explorer for U.S. presidential election results from 1976
through 2024. Open `index.html` directly or serve the folder with any static
server.

## Run locally

Serve this directory with any static server. For example:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Data

- State and national returns: MIT Election Data and Science Lab,
  [U.S. President 1976–2024](https://doi.org/10.7910/DVN/42MVDX).
- National demographic crosstabs: Roper Center "How Groups Voted" exit-poll
  summaries for 2008, 2012, 2016, 2020, and 2024.

No synthetic historical election results are included. Missing demographic
years or categories are disabled and shown as unavailable.
