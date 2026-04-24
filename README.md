# Cobh transport board

A simple public train board for Cobh station, designed for embedding on The Arch website and later reuse on a small screen.

## Files

- `index.html` - the public board page.
- `style.css` - board styling.
- `app.js` - browser logic that reads the cached JSON file.
- `data/cobh-trains.json` - latest cached Cobh station data.
- `scripts/fetch_cobh_trains.py` - fetches Irish Rail station data and writes JSON.
- `.github/workflows/update-cobh-trains.yml` - refreshes the JSON file every 10 minutes.

## GitHub Pages setup

If GitHub Pages is not already enabled:

1. Open this repository in GitHub.
2. Go to Settings > Pages.
3. Under Build and deployment, choose Deploy from a branch.
4. Select `main` and `/root`.
5. Save.

The page should then be available at:

`https://thearchcobh.github.io/transport/`

## Squarespace embed

Add a Code Block to the Squarespace page and paste:

```html
<iframe
  src="https://thearchcobh.github.io/transport/"
  style="width:100%; height:720px; border:0; overflow:hidden;"
  loading="lazy">
</iframe>
```

## Notes

The Irish Rail API can provide real-time station data where available. Irish Rail notes that coverage on the Cork to Cobh and Midleton line may be limited, so some services may show scheduled times rather than live running information.
