import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

import sharp from "sharp";
import { consumeOneCredit, getCreditBalance } from "@/lib/credits-wallet";
import { getCurrentUser } from "@/lib/current-user";
import { captureApiError, logEvent } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolveCanonicalUserIds } from "@/lib/user-canonical";
import { generateBodySchema } from "@/lib/validation";
import { recoverMissingSubscriptionCredits } from "@/lib/subscription-credit-recovery";

function cleanEnv(value?: string) {
  if (!value) return "";
  return value.replace(/\\r\\n/g, "").replace(/[\r\n]+$/g, "").trim();
}

type ImageProvider = "gemini" | "kie";

function preferredImageProvider(): ImageProvider {
  const v = cleanEnv(process.env.IMAGE_PROVIDER).toLowerCase();
  return v === "kie" ? "kie" : "gemini";
}

function skillGuidance(skillLevel?: string | null) {
  const level = (skillLevel || "beginner").toLowerCase();

  if (level === "pro") {
    return "Target output: advanced/pro marker artist. Push rich value range, nuanced color temperature shifts, confident shadow design, polished finishing details, and deliberate full-scene color separation.";
  }

  if (level === "experienced") {
    return "Target output: experienced marker artist. Use clean blends, strong readability, controlled contrast, tasteful detail density, and clear color separation across major objects.";
  }

  if (level === "learning") {
    return "Target output: intermediate/learning marker artist. Keep transitions smooth and forms clear, avoid overcomplicated textures, and prioritize good color harmony. Mandatory coverage rule: fully color all intended regions and fill the full canvas composition. Do NOT leave large blank/uncolored paper areas, pale washed-out zones, or half-finished sections.";
  }

  return "Target output: beginner-friendly marker result, but still polished and complete. Keep it simple, readable, and forgiving with clear local colors, visible contrast, and full confident fills. Do NOT interpret beginner as faint, low-saturation, beige-heavy, or mostly-white. Mandatory coverage rule: fully color all intended regions and fill the full canvas composition. No large blank/uncolored paper areas, no half-finished look, no washed-out result.";
}

type MarkerSelection = { brand: string; series: string; setSize: string; extraColors?: string[] };

function markerGuidance(markerSelections?: MarkerSelection[]) {
  if (!markerSelections || markerSelections.length === 0) {
    return "User marker inventory is unknown. Keep palette practical and generally achievable with common alcohol marker sets.";
  }

  const inventory = markerSelections
    .slice(0, 6)
    .map((m) => {
      const extras = m.extraColors && m.extraColors.length > 0 ? ` + extras: ${m.extraColors.join("/")}` : "";
      return `${m.brand} ${m.series} (${m.setSize})${extras}`;
    })
    .join(", ");

  return [
    `User marker inventory: ${inventory}.`,
    "Very important: choose colors and blending decisions that are realistic with this inventory.",
    "Avoid relying on rare/unavailable colors outside the listed sets.",
  ].join(" ");
}

function buildPrompt(theme: string, skillLevel?: string | null, markerSelections?: MarkerSelection[], specialWishes?: string) {
  return [
    "Transform the uploaded sketch into a NEW alcohol-marker style illustration.",
    `Theme: ${theme}.`,
    skillGuidance(skillLevel),
    markerGuidance(markerSelections),
    specialWishes ? `Special wishes from user: ${specialWishes}.` : null,
    "Keep composition recognizable but create a fresh rendered result, not a near-identical faded copy of the input.",
    "Use marker-like blending, selective shadows, clean highlights, and clear color blocking between major objects.",
    "The final image MUST be fully colorized, visually rich, and clearly finished.",
    "Critical coverage rule: avoid accidental empty or white patches. Fully color all major regions of the subject and background unless the line art clearly indicates tiny paper-white highlights only.",
    "Do not leave shelves, walls, objects, or background areas half-colored, cream-only, or barely tinted.",
    "Never return a plain line-art sketch, monochrome-only result, mostly-white page, faint pastel wash, or unfinished-looking render.",
    "Color requirement: use at least 7 clearly visible colored regions across subject and background elements, with obvious separation between foreground items.",
    "Prefer warm, cozy, attractive marker colors with readable contrast. Beginner mode should still look deliberate, colorful, and complete.",
    "Add white marker accents and subtle gel-pen sparkle details, but keep them small and intentional, never as large uncolored zones.",
    "Return only the generated image.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
  inputMimeType: string;
  inputBase64: string;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: params.prompt },
              {
                inlineData: {
                  mimeType: params.inputMimeType,
                  data: params.inputBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    const status = response.status;
    const transient = status === 429 || status >= 500;
    throw new Error(`Gemini API request failed (${status})${transient ? " [TRANSIENT]" : ""}: ${details}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini returned no image");
  }

  return {
    mimeType: imagePart.inlineData.mimeType || "image/png",
    base64: imagePart.inlineData.data,
  };
}

const MAX_RETRIES_PER_MODEL = 2;
const MIN_RESULT_BYTES = 18_000;

const DEPRECATED_MODELS = new Set([
  "gemini-2.0-flash-preview-image-generation",
]);

const FALLBACK_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
];

async function generateWithGemini(params: {
  apiKey: string;
  prompt: string;
  inputMimeType: string;
  inputBase64: string;
}) {
  const preferredModel =
    cleanEnv(process.env.GOOGLE_AI_MODEL) ||
    cleanEnv(process.env.GOOGLE_MODEL) ||
    cleanEnv(process.env.GEMINI_MODEL) ||
    cleanEnv(process.env.GOOGLE_IMAGE_MODEL) ||
    "";

  const candidates = [
    preferredModel,
    ...FALLBACK_MODELS,
  ].filter((v, i, arr) => !!v && arr.indexOf(v) === i && !DEPRECATED_MODELS.has(v));

  let lastError: unknown;
  for (const model of candidates) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        return await callGemini({ ...params, model });
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);

        const modelBroken =
          message.includes("(404)") ||
          message.includes("Gemini returned no image") ||
          message.includes("responseModalities") ||
          message.includes("does not support");

        if (modelBroken) {
          logEvent("warn", {
            area: "generate",
            event: "model_skip",
            meta: { model, message: message.slice(0, 240) },
          });
          break; // skip to next model
        }

        const transientRetryable =
          message.includes("SAFETY") ||
          message.includes("RECITATION") ||
          message.includes("[TRANSIENT]") ||
          message.includes("(429)") ||
          message.includes("(500)") ||
          message.includes("(502)") ||
          message.includes("(503)") ||
          message.includes("(504)");

        if (!transientRetryable) throw error; // non-retryable, bail

        logEvent("warn", {
          area: "generate",
          event: "model_retry",
          meta: { model, attempt, message: message.slice(0, 240) },
        });

        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini generation failed");
}

function extractKieImageUrl(record: unknown): string | null {
  const data = (record as { data?: { resultJson?: unknown } } | null)?.data?.resultJson;
  if (!data) return null;

  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }

  const stack: unknown[] = [parsed];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    if (typeof cur === "string" && /^https?:\/\//i.test(cur)) {
      return cur;
    }
    if (Array.isArray(cur)) {
      stack.push(...cur);
      continue;
    }
    if (typeof cur === "object") {
      for (const v of Object.values(cur as Record<string, unknown>)) stack.push(v);
    }
  }

  return null;
}

async function generateWithKie(params: {
  apiKey: string;
  prompt: string;
  inputMimeType: string;
  inputBase64: string;
  inputImageUrl?: string;
}) {
  const baseUrl = cleanEnv(process.env.KIE_API_BASE) || "https://api.kie.ai";
  const model = cleanEnv(process.env.KIE_MODEL) || "nano-banana-2";

  const createRes = await fetch(`${baseUrl}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: {
        prompt: params.prompt,
        aspect_ratio: "9:16",
        resolution: "2K",
        output_format: "png",
        google_search: false,
        image_input: params.inputImageUrl ? [params.inputImageUrl] : [`data:${params.inputMimeType};base64,${params.inputBase64}`],
      },
    }),
  });

  if (!createRes.ok) {
    const details = await createRes.text();
    throw new Error(`Kie createTask failed (${createRes.status}) [TRANSIENT]: ${details}`);
  }

  const created = (await createRes.json()) as { code?: number; msg?: string; data?: { taskId?: string; task_id?: string; jobId?: string; id?: string } };
  const taskId = created?.data?.taskId || created?.data?.task_id || created?.data?.jobId || created?.data?.id;
  if (!taskId) {
    throw new Error(`Kie createTask returned no taskId: ${JSON.stringify(created).slice(0, 260)}`);
  }

  const maxPolls = 45;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, 1500));

    const recRes = await fetch(`${baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
      },
    });

    if (!recRes.ok) {
      const details = await recRes.text();
      throw new Error(`Kie recordInfo failed (${recRes.status}) [TRANSIENT]: ${details}`);
    }

    const record = (await recRes.json()) as {
      data?: { state?: string; failMsg?: string; failCode?: string; resultJson?: unknown };
    };

    const state = record?.data?.state;
    if (state === "success") {
      const imageUrl = extractKieImageUrl(record);
      if (!imageUrl) throw new Error("Kie success without image URL");

      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        throw new Error(`Kie image download failed (${imageRes.status}) [TRANSIENT]`);
      }

      const mimeType = imageRes.headers.get("content-type") || "image/png";
      const arrayBuffer = await imageRes.arrayBuffer();
      return {
        mimeType,
        base64: Buffer.from(arrayBuffer).toString("base64"),
      };
    }

    if (state === "fail") {
      const failMsg = record?.data?.failMsg || "unknown";
      const failCode = record?.data?.failCode || "";
      throw new Error(`Kie generation failed (${failCode}): ${failMsg}`);
    }
  }

  throw new Error("Kie generation timed out [TRANSIENT]");
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let user: { skillLevel: string | null } = {
    skillLevel: null,
  };
  let dbAvailable = true;
  let canonicalUserIds = [currentUser.id];
  let generationOwnerId = currentUser.id;

  try {
    const canonical = await resolveCanonicalUserIds({
      currentUserId: currentUser.id,
      email: currentUser.email,
    });

    canonicalUserIds = canonical.userIds;
    generationOwnerId = canonical.primaryUserId;

    const row = await prisma.user.findUnique({
      where: { id: generationOwnerId },
      select: { skillLevel: true },
    });

    if (row) {
      user = row;
    }
  } catch (error) {
    dbAvailable = false;
    logEvent("warn", {
      area: "generate",
      event: "db_unavailable_precheck",
      meta: { userId: currentUser.id, message: error instanceof Error ? error.message : String(error) },
    });
  }

  const FREE_TRIAL_LIMIT = 2;
  const usedGenerations = dbAvailable
    ? Number(
        (
          await prisma.$queryRawUnsafe(
            `select coalesce(free_trial_used_count, 0)::int as used from users where id = $1::uuid limit 1`,
            generationOwnerId
          )
        )?.[0]?.used ?? 0
      )
    : 0;

  let walletCredits = dbAvailable ? await getCreditBalance(generationOwnerId) : 1;

  if (dbAvailable && walletCredits <= 0) {
    try {
      await recoverMissingSubscriptionCredits({
        userId: generationOwnerId,
        email: currentUser.email,
        source: "generate",
      });
      walletCredits = await getCreditBalance(generationOwnerId);
    } catch (error) {
      logEvent("warn", {
        area: "generate",
        event: "subscription_recovery_failed",
        meta: {
          userId: generationOwnerId,
          message: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
        },
      });
    }
  }

  if (usedGenerations >= FREE_TRIAL_LIMIT && walletCredits <= 0) {
    return NextResponse.json(
      {
        error: "Payment Required",
        code: "CREDITS_REQUIRED",
        trialLimit: FREE_TRIAL_LIMIT,
        used: usedGenerations,
        creditsRemaining: walletCredits,
      },
      { status: 402 }
    );
  }

  const shouldConsumeCredit = walletCredits > 0;

  const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const normalizedBody = {
    uploadPath: typeof rawBody?.uploadPath === "string" ? rawBody.uploadPath : "",
    theme:
      typeof rawBody?.theme === "string" && rawBody.theme.trim().length > 0
        ? rawBody.theme.trim().slice(0, 120)
        : "cozy kawaii", 
    specialWishes:
      typeof rawBody?.specialWishes === "string" ? rawBody.specialWishes.slice(0, 120) : undefined,
    markerSelections: Array.isArray(rawBody?.markerSelections)
      ? rawBody.markerSelections
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const o = item as Record<string, unknown>;
            const brand = typeof o.brand === "string" ? o.brand : "";
            const series = typeof o.series === "string" ? o.series : "";
            const setSize = typeof o.setSize === "string" ? o.setSize : "";
            const extraColors = Array.isArray(o.extraColors)
              ? o.extraColors
                  .filter((v): v is string => typeof v === "string")
                  .map((v) => v.trim().slice(0, 12))
                  .filter((v) => v.length > 0)
                  .slice(0, 3)
              : undefined;

            if (!brand || !series || !setSize) return null;
            return { brand, series, setSize, ...(extraColors ? { extraColors } : {}) };
          })
          .filter((v): v is { brand: string; series: string; setSize: string; extraColors?: string[] } => !!v)
      : undefined,
    inlineImageBase64: typeof rawBody?.inlineImageBase64 === "string" ? rawBody.inlineImageBase64 : undefined,
    inlineImageMimeType:
      rawBody?.inlineImageMimeType === "image/png" || rawBody?.inlineImageMimeType === "image/jpeg"
        ? rawBody.inlineImageMimeType
        : undefined,
  };

  const parsedBody = generateBodySchema.safeParse(normalizedBody);

  const resilientBody = parsedBody.success
    ? parsedBody.data
    : {
        uploadPath: normalizedBody.uploadPath.trim(),
        theme: normalizedBody.theme.trim().slice(0, 120) || "cozy kawaii",
        specialWishes: normalizedBody.specialWishes?.trim().slice(0, 120),
        markerSelections: normalizedBody.markerSelections ?? [],
        inlineImageBase64: normalizedBody.inlineImageBase64?.trim(),
        inlineImageMimeType: normalizedBody.inlineImageMimeType,
      };

  if (!resilientBody.uploadPath) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const uploadPath = resilientBody.uploadPath.trim();
  const theme = resilientBody.theme.trim();
  const markerSelections = resilientBody.markerSelections ?? [];
  const specialWishes = resilientBody.specialWishes?.trim();
  const inlineImageBase64 = resilientBody.inlineImageBase64?.trim();
  const inlineImageMimeType =
    resilientBody.inlineImageMimeType === "image/png" || resilientBody.inlineImageMimeType === "image/jpeg"
      ? resilientBody.inlineImageMimeType
      : undefined;

  const uploadOwnerAllowed = canonicalUserIds.some((uid) => uploadPath.startsWith(`${uid}/`));
  if (!uploadOwnerAllowed) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 403 });
  }

  const t0 = Date.now();
  let stage = "init";

  try {
    stage = "supabase_client";
    const supabase = getSupabaseServerClient();

    let inputMimeType: "image/png" | "image/jpeg" = uploadPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    let inputBytes: ArrayBuffer | Buffer;

    if (inlineImageBase64 && inlineImageMimeType) {
      inputMimeType = inlineImageMimeType;
      inputBytes = Buffer.from(inlineImageBase64, "base64");
    } else {
      stage = "download_upload";
      let uploadedFile: Blob | null = null;
      let lastDownloadError: unknown = null;

      for (let attempt = 0; attempt < 10; attempt++) {
        const result = await supabase.storage.from("uploads").download(uploadPath);
        if (result.data) {
          uploadedFile = result.data;
          break;
        }
        lastDownloadError = result.error;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }

      if (!uploadedFile) {
        captureApiError(lastDownloadError ?? new Error("Upload file not found"), {
          area: "generate",
          event: "upload_missing",
          meta: { userId: currentUser.id, uploadPath },
        });
        return NextResponse.json({ error: "Upload file not found" }, { status: 400 });
      }

      inputBytes = await uploadedFile.arrayBuffer();
    }

    const geminiKey = cleanEnv(process.env.GOOGLE_AI_API_KEY);
    const kieKey = cleanEnv(process.env.KIE_API_KEY);

    const inputBase64 = Buffer.isBuffer(inputBytes)
      ? inputBytes.toString("base64")
      : Buffer.from(inputBytes).toString("base64");

    const basePrompt = buildPrompt(theme, user.skillLevel, markerSelections as MarkerSelection[], specialWishes);

    const provider = preferredImageProvider();
    let generated: { mimeType: string; base64: string };

    if (provider === "kie") {
      if (!kieKey) {
        return NextResponse.json({ error: "Kie API key missing" }, { status: 500 });
      }

      stage = "kie_prepare_input";
      let kieInputImageUrl: string | undefined;
      const signedUpload = await supabase.storage.from("uploads").createSignedUrl(uploadPath, 60 * 10);
      if (!signedUpload.error && signedUpload.data?.signedUrl) {
        kieInputImageUrl = signedUpload.data.signedUrl;
      }

      stage = "kie_generate";
      try {
        generated = await generateWithKie({
          apiKey: kieKey,
          prompt: basePrompt,
          inputMimeType,
          inputBase64,
          inputImageUrl: kieInputImageUrl,
        });
      } catch (kieError) {
        if (!geminiKey) throw kieError;

        logEvent("warn", {
          area: "generate",
          event: "kie_fallback_to_gemini",
          meta: {
            userId: currentUser.id,
            message: kieError instanceof Error ? kieError.message.slice(0, 220) : String(kieError).slice(0, 220),
          },
        });

        stage = "gemini_fallback_generate";
        generated = await generateWithGemini({
          apiKey: geminiKey,
          prompt: basePrompt,
          inputMimeType,
          inputBase64,
        });
      }
    } else {
      if (!geminiKey) {
        return NextResponse.json({ error: "Gemini API key missing" }, { status: 500 });
      }

      stage = "gemini_generate";
      generated = await generateWithGemini({
        apiKey: geminiKey,
        prompt: basePrompt,
        inputMimeType,
        inputBase64,
      });
    }

    let outputBytes = Buffer.from(generated.base64, "base64");

    // Guardrail: occasionally image models return near-empty line-art/blank pages.
    // If payload is suspiciously tiny, run one stronger retry prompt (Gemini path).
    if (outputBytes.byteLength < MIN_RESULT_BYTES && geminiKey) {
      logEvent("warn", {
        area: "generate",
        event: "retry_low_entropy_output",
        meta: { userId: currentUser.id, bytes: outputBytes.byteLength, provider },
      });

      stage = "gemini_regenerate_low_entropy";
      const stronger = await generateWithGemini({
        apiKey: geminiKey,
        prompt: [
          basePrompt,
          "MANDATORY FIX: previous output looked near-empty, washed-out, or undercolored.",
          "Regenerate with clear confident color fills, stronger readable contrast, and full coverage across the whole composition.",
          "Do not return line art only, pale beige wash, or a half-finished page.",
        ].join("\n"),
        inputMimeType,
        inputBase64,
      });

      generated = stronger;
      outputBytes = Buffer.from(generated.base64, "base64");
    }

    const ext = generated.mimeType.includes("png") ? "png" : "jpg";
    const safeTheme = theme
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);
    const resultPath = `${currentUser.id}/${crypto.randomUUID()}-${safeTheme || "preview"}.${ext}`;

    stage = "upload_result";
    const { error: uploadError } = await supabase.storage.from("results").upload(resultPath, outputBytes, {
      contentType: generated.mimeType,
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const thumbPath = resultPath.replace(/([^/]+)$/, "thumb-$1.jpg");
    try {
      const thumbBuffer = await sharp(outputBytes)
        .resize(320, 320, { fit: "cover" })
        .jpeg({ quality: 60 })
        .toBuffer();

      await supabase.storage.from("results").upload(thumbPath, thumbBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });
    } catch (thumbError) {
      logEvent("warn", {
        area: "generate",
        event: "thumbnail_upload_failed",
        meta: {
          userId: generationOwnerId,
          resultPath,
          message: thumbError instanceof Error ? thumbError.message.slice(0, 180) : String(thumbError).slice(0, 180),
        },
      });
    }

    stage = "signed_url";
    const { data: signedData, error: signedError } = await supabase.storage
      .from("results")
      .createSignedUrl(resultPath, 60 * 10);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(signedError?.message ?? "Could not create result URL");
    }

    stage = "db_record";
    let generationRecorded = false;
    let recordFailureReason = "";

    try {
      await prisma.$transaction(async (tx) => {
        await tx.generation.create({
          data: {
            userId: generationOwnerId,
            uploadPath,
            resultPath,
            theme,
          },
        });
      });
      generationRecorded = true;
    } catch (error) {
      recordFailureReason = error instanceof Error ? error.message : String(error);
      logEvent("warn", {
        area: "generate",
        event: "generation_record_tx_failed",
        meta: { userId: generationOwnerId, message: recordFailureReason.slice(0, 240) },
      });
    }

    if (!generationRecorded) {
      try {
        await prisma.$executeRaw`
          INSERT INTO generations (user_id, upload_path, result_path, theme)
          VALUES (${generationOwnerId}::uuid, ${uploadPath}, ${resultPath}, ${theme})
        `;
        generationRecorded = true;
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logEvent("error", {
          area: "generate",
          event: "generation_record_fallback_failed",
          meta: {
            userId: generationOwnerId,
            reason: recordFailureReason.slice(0, 180),
            fallback: fallbackMessage.slice(0, 180),
          },
        });
      }
    }

    if (!generationRecorded) {
      return NextResponse.json(
        {
          error: "Generated image saved, but gallery record failed. Please try again.",
          stage: "db_record",
        },
        { status: 500 }
      );
    }

    if (shouldConsumeCredit) {
      const consumed = await consumeOneCredit(generationOwnerId);
      if (!consumed.ok) {
        return NextResponse.json(
          {
            error: "Not enough credits",
            code: "CREDITS_REQUIRED",
          },
          { status: 402 }
        );
      }
    } else if (dbAvailable && usedGenerations < FREE_TRIAL_LIMIT) {
      await prisma.$executeRawUnsafe(
        `update users set free_trial_used_count = coalesce(free_trial_used_count, 0) + 1, updated_at = now() where id = $1::uuid`,
        generationOwnerId
      );
    }

    logEvent("info", {
      area: "generate",
      event: "success",
      meta: { userId: generationOwnerId, ms: Date.now() - t0 },
    });

    return NextResponse.json({ resultUrl: signedData.signedUrl, resultPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const debugId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    captureApiError(error, {
      area: "generate",
      event: "failed",
      meta: { userId: currentUser.id, uploadPath, ms: Date.now() - t0, stage, debugId, message: message.slice(0, 240) },
    });

    const busy = message.includes("[TRANSIENT]") || message.includes("(429)") || message.includes("(500)") || message.includes("(502)") || message.includes("(503)") || message.includes("(504)");
    const safety = message.includes("SAFETY") || message.includes("RECITATION");

    const userMessage = busy
      ? "AI service is busy. Please try again in a few seconds."
      : safety
      ? "This image was flagged by safety filters. Try a different sketch or theme."
      : "Generation failed. Please try again.";

    return NextResponse.json(
      {
        error: userMessage,
        stage,
        debugId,
      },
      { status: safety ? 422 : 500 }
    );
  }
}
