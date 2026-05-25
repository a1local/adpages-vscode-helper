import * as vscode from "vscode";

const GOOGLE_AD_LIMITS = {
  headline: 30,
  description: 90,
} as const;

type AdCopyType = keyof typeof GOOGLE_AD_LIMITS;

type SchemaInput = {
  name: string;
  url?: string;
  telephone?: string;
  businessType: string;
  locality?: string;
  region?: string;
  country?: string;
};

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("adpagesHelper.buildUtmUrl", buildUtmUrl),
    vscode.commands.registerCommand("adpagesHelper.checkGoogleAdsCopy", checkGoogleAdsCopy),
    vscode.commands.registerCommand("adpagesHelper.generateLocalBusinessSchema", generateLocalBusinessSchema),
  );
}

export function deactivate(): void {
  // No background processes to dispose.
}

async function buildUtmUrl(): Promise<void> {
  const baseUrl = await promptRequired("Destination URL", "https://example.com/service");
  if (!baseUrl) {
    return;
  }

  const source = await promptRequired("Campaign source", "google");
  if (!source) {
    return;
  }

  const medium = await promptRequired("Campaign medium", "cpc");
  if (!medium) {
    return;
  }

  const campaign = await promptRequired("Campaign name", "emergency-plumber-perth");
  if (!campaign) {
    return;
  }

  const term = await vscode.window.showInputBox({
    prompt: "Campaign term (optional)",
    placeHolder: "emergency plumber",
  });
  const content = await vscode.window.showInputBox({
    prompt: "Campaign content (optional)",
    placeHolder: "rsa-headline-a",
  });

  const result = createUtmUrl(baseUrl, {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
    utm_term: term,
    utm_content: content,
  });

  if (!result.ok) {
    void vscode.window.showErrorMessage(result.error);
    return;
  }

  await vscode.env.clipboard.writeText(result.url);
  void vscode.window.showInformationMessage(`UTM URL copied: ${result.url}`);
}

async function checkGoogleAdsCopy(): Promise<void> {
  const typePick = await vscode.window.showQuickPick(
    [
      { label: "Headline", value: "headline" as const, description: "30 character limit" },
      { label: "Description", value: "description" as const, description: "90 character limit" },
    ],
    { placeHolder: "Choose the Google Ads field to check" },
  );
  if (!typePick) {
    return;
  }

  const selectedText = getSelectedText();
  const text =
    selectedText ||
    (await promptRequired(`${typePick.label} text`, typePick.value === "headline" ? "Emergency Plumber Perth" : "Fast local help for urgent plumbing issues."));
  if (!text) {
    return;
  }

  const result = checkAdCopyLength(text, typePick.value);
  const summary = `${typePick.label}: ${result.length}/${result.limit} characters (${result.remaining >= 0 ? `${result.remaining} remaining` : `${Math.abs(result.remaining)} over`})`;

  if (result.valid) {
    await vscode.env.clipboard.writeText(summary);
    void vscode.window.showInformationMessage(`${summary}. Summary copied.`);
  } else {
    await vscode.env.clipboard.writeText(`${summary}. Trim ${Math.abs(result.remaining)} characters.`);
    void vscode.window.showWarningMessage(`${summary}. Trim ${Math.abs(result.remaining)} characters.`);
  }
}

async function generateLocalBusinessSchema(): Promise<void> {
  const name = await promptRequired("Business name", "A1 Local Plumbing");
  if (!name) {
    return;
  }

  const businessType =
    (await vscode.window.showInputBox({
      prompt: "Schema type",
      placeHolder: "LocalBusiness",
      value: "LocalBusiness",
    })) || "LocalBusiness";
  const url = await vscode.window.showInputBox({ prompt: "Website URL (optional)", placeHolder: "https://example.com" });
  const telephone = await vscode.window.showInputBox({ prompt: "Telephone (optional)", placeHolder: "+61 8 0000 0000" });
  const locality = await vscode.window.showInputBox({ prompt: "Address locality (optional)", placeHolder: "Perth" });
  const region = await vscode.window.showInputBox({ prompt: "Address region/state (optional)", placeHolder: "WA" });
  const country = await vscode.window.showInputBox({ prompt: "Address country (optional)", placeHolder: "AU" });

  const snippet = createLocalBusinessSchemaSnippet({
    name,
    businessType,
    url,
    telephone,
    locality,
    region,
    country,
  });

  const editor = vscode.window.activeTextEditor;
  if (editor && ["html", "astro", "javascript", "typescript", "json"].includes(editor.document.languageId)) {
    const insert = await vscode.window.showQuickPick(["Insert into current editor", "Open in new editor"], {
      placeHolder: "Where should the schema snippet go?",
    });
    if (insert === "Insert into current editor") {
      await editor.edit((editBuilder) => editBuilder.insert(editor.selection.active, snippet));
      return;
    }
  }

  const document = await vscode.workspace.openTextDocument({
    content: snippet,
    language: "html",
  });
  await vscode.window.showTextDocument(document);
}

function createUtmUrl(
  baseUrl: string,
  params: Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content", string | undefined>,
): { ok: true; url: string } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return { ok: false, error: "Enter a valid absolute URL, including https://." };
  }

  for (const [key, value] of Object.entries(params)) {
    const normalized = normalizeCampaignValue(value);
    if (normalized) {
      parsed.searchParams.set(key, normalized);
    }
  }

  return { ok: true, url: parsed.toString() };
}

function checkAdCopyLength(text: string, type: AdCopyType): { valid: boolean; length: number; limit: number; remaining: number } {
  const length = [...text.trim()].length;
  const limit = GOOGLE_AD_LIMITS[type];
  return {
    valid: length <= limit,
    length,
    limit,
    remaining: limit - length,
  };
}

function createLocalBusinessSchemaSnippet(input: SchemaInput): string {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": input.businessType || "LocalBusiness",
    name: input.name,
  };

  assignOptional(schema, "url", input.url);
  assignOptional(schema, "telephone", input.telephone);

  const address: Record<string, string> = {};
  assignOptional(address, "addressLocality", input.locality);
  assignOptional(address, "addressRegion", input.region);
  assignOptional(address, "addressCountry", input.country);
  if (Object.keys(address).length > 0) {
    schema.address = {
      "@type": "PostalAddress",
      ...address,
    };
  }

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>\n`;
}

function assignOptional(target: Record<string, unknown>, key: string, value: string | undefined): void {
  const trimmed = value?.trim();
  if (trimmed) {
    target[key] = trimmed;
  }
}

function normalizeCampaignValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.toLowerCase().replace(/[\s_]+/g, "-");
}

function getSelectedText(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    return undefined;
  }

  return editor.document.getText(editor.selection).trim();
}

async function promptRequired(prompt: string, placeHolder: string): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    prompt,
    placeHolder,
    validateInput: (input) => (input.trim().length === 0 ? "Required" : undefined),
  });

  return value?.trim();
}
