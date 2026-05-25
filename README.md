# AdPages Helper

AdPages Helper is a dependency-light VS Code extension scaffold for local marketing workflows. It runs entirely inside VS Code and does not make network calls.

## Commands

- `AdPages: Build UTM URL` prompts for a destination URL and campaign fields, then copies a tagged URL to the clipboard.
- `AdPages: Check Google Ads Copy Length` checks selected text or prompted text against Google Ads headline and description limits.
- `AdPages: Generate LocalBusiness Schema` prompts for business details and creates a JSON-LD snippet in a new editor tab.

## Local Development

```bash
npm install
npm run compile
```

Open this folder in VS Code, press `F5`, and run the commands from the Command Palette in the Extension Development Host.

## Marketplace Notes

This scaffold is intentionally minimal for later Visual Studio Marketplace publishing. Before publishing, replace the placeholder publisher, add icons/screenshots, add a privacy policy URL, and set `"private": false` once the listing is ready.
