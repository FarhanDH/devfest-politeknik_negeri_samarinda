"use node";
import { generateObject, generateText } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { action } from "./_generated/server";
import {
    DEFAULT_MODEL,
    MISTRAL_NEMO_MODEL
} from "./constants";
import {
    openrouter
} from "./lib";
import {
    analyzePDFContent,
    analyzeTextContent,
    createPDFUserPrompt,
    createSystemPrompt,
    createTextUserPrompt,
    createWEBUserPrompt,
    encodePDFFromCloudURL,
    extractPDFContent,
    shouldUseOCR,
    validateAndEnhanceSummary,
    websiteContentExtractor,
} from "./utils";

/**
 * PDF Summarizer Action - Processes PDF documents for educational quiz generation
 *
 * A comprehensive Convex action that handles the complete PDF processing pipeline:
 * 1. Downloads and encodes PDF from cloud URL
 * 2. Determines optimal extraction method (text vs OCR)
 * 3. Extracts content using OpenRouter AI
 * 4. Analyzes and structures content for educational use
 * 5. Generates learning summary optimized for quiz creation
 * 6. Validates output quality and enhances with metadata
 *
 * @param pdfPath - Cloud URL pointing to the PDF file to process
 * @param targetAudience - Educational level (smp/sma/kuliah/umum), defaults to 'sma'
 * @param focusArea - Optional subject area to emphasize (e.g., 'matematika', 'sains')
 * @param extractionMethod - PDF extraction method (text/ocr/auto), defaults to 'auto'
 *
 * @returns Object containing validated summary and comprehensive metadata
 *
 * @throws {Error} When PDF processing fails, content is too short, or validation fails
 *
 * @example
 * ```typescript
 * const result = await ctx.runAction(api.ai.pdfSummarizer, {
 *   pdfPath: 'https://example.com/textbook.pdf',
 *   targetAudience: 'sma',
 *   focusArea: 'matematika'
 * });
 * console.log(`Summary: ${result.summary.length} characters`);
 * console.log(`Language: ${result.metadata.language}`);
 * ```
 */
export const pdfSummarizer = action({
    args: {
        pdfPath: v.string(),
        targetAudience: v.optional(
            v.union(
                v.literal("smp"),
                v.literal("sma"),
                v.literal("kuliah"),
                v.literal("umum"),
            ),
        ),
        focusArea: v.optional(v.string()),
        extractionMethod: v.optional(
            v.union(v.literal("text"), v.literal("ocr"), v.literal("auto")),
        ),
    },
    handler: async (ctx, args) => {
        try {
            // Step 1: Encode PDF
            const { base64PDF, fileSize, fileName } = await encodePDFFromCloudURL(
                args.pdfPath,
            );

            // Step 2: Determine extraction method
            const extractionMethod = args.extractionMethod || "auto";
            const useOCR = shouldUseOCR(extractionMethod, fileSize);

            // Step 3: Extract content using OpenRouter
            const extractedContent = await extractPDFContent(
                base64PDF,
                fileName,
                useOCR,
            );

            if (!extractedContent || extractedContent.length < 300) {
                throw new Error("Konten PDF terlalu pendek atau tidak dapat diekstrak");
            }

            // Step 4: Analyze content (reuse website analysis logic)
            const processedContent = analyzePDFContent(
                extractedContent,
                fileName,
                fileSize,
            );
            processedContent.processingMethod = useOCR ? "ocr" : "text-extraction";

            // Step 5: Generate summary (reuse website summarization logic)
            const systemPrompt = createSystemPrompt(
                processedContent.language,
                processedContent.contentType,
                args.targetAudience,
            );

            const userPrompt = createPDFUserPrompt({
                fileName: processedContent.fileName,
                content: processedContent.content,
                metrics: processedContent.metrics,
                contentType: processedContent.contentType,
                language: processedContent.language,
                targetAudience: args.targetAudience || "sma",
                focusArea: args.focusArea,
            });

            // Step 6: Call OpenRouter for summarization using AI SDK
            const { text: summary } = await generateText({
                model: openrouter(DEFAULT_MODEL),
                system: systemPrompt,
                prompt: userPrompt,
                temperature: 0.2,
                maxTokens: 3000,
                topP: 0.9,
                frequencyPenalty: 0.1,
                presencePenalty: 0.1,
            });

            // Step 7: Validate summary (reuse validation logic)
            const validatedSummary = validateAndEnhanceSummary(summary, {
                title: fileName,
                content: processedContent.content,
                metrics: {
                    wordCount: processedContent.metrics.wordCount,
                    headingCount: 0, // PDF doesn't have HTML headings
                    listItemCount: 0,
                    paragraphCount: processedContent.content.split("\n\n").length,
                    hasTableOfContents: processedContent.metrics.hasTableOfContents,
                    estimatedReadingTime: processedContent.metrics.estimatedReadingTime,
                },
                contentType: processedContent.contentType,
                language: processedContent.language,
            });

            if (!validatedSummary) {
                throw new Error(
                    "Rangkuman tidak memenuhi standar kualitas untuk quiz generation",
                );
            }

            // Step 8: Return enhanced result
            console.log(`PDF berhasil diproses: ${fileName}`, {
                fileSize: `${Math.round(fileSize / 1024)}KB`,
                wordCount: processedContent.metrics.wordCount,
                contentType: processedContent.contentType,
                language: processedContent.language,
                processingMethod: processedContent.processingMethod,
            });

            return {
                summary: validatedSummary,
                metadata: {
                    sourceTitle: fileName,
                    sourceUrl: args.pdfPath,
                    contentType: processedContent.contentType,
                    language: processedContent.language,
                    metrics: processedContent.metrics,
                    processingMethod: processedContent.processingMethod,
                    generatedAt: new Date().toISOString(),
                },
            };
        } catch (error) {
            console.error("Error dalam pdfSummarizer:", error);
            if (error instanceof Error) {
                throw new Error(`Gagal menghasilkan rangkuman: ${error.message}`);
            }
            throw new Error(`Gagal menghasilkan rangkuman: ${String(error)}`);
        }
    },
});

/**
 * Generates a summarized version of a website's content and prepares it for quiz generation.
 *
 * This action extracts content from the provided URL, validates its length, and uses an LLM
 * (via OpenRouter API) to generate a summary tailored to the specified target audience and focus area.
 * It supports generating content for different quiz types (multiple choice, essay, or mixed).
 * The summary is validated and enhanced before being returned along with relevant metadata.
 *
 * @param args.url - The URL of the website to summarize.
 * @param args.targetAudience - (Optional) The intended audience for the summary and quiz.
 *   Can be "smp", "sma", "kuliah", or "umum".
 * @param args.focusArea - (Optional) The specific subject area to focus on (e.g., "matematika", "sains").
 * @returns An object containing the validated summary and metadata about the source and generation process.
 * @throws If content extraction fails, the content is too short, the API call fails, or the summary does not meet quality standards.
 */
export const websiteSummarizer = action({
    args: {
        url: v.string(),
        targetAudience: v.optional(
            v.union(
                v.literal("smp"),
                v.literal("sma"),
                v.literal("kuliah"),
                v.literal("umum"),
            ),
        ),
        focusArea: v.optional(v.string()), // matematika, sains, sejarah, dll
    },
    handler: async (ctx, args) => {
        const extractedData = await websiteContentExtractor(args.url);
        if (!extractedData) {
            throw new Error("Gagal mengekstrak konten dari website");
        }

        const { title, content, metrics, contentType, language } = extractedData;

        // Validasi konten minimum untuk quiz generation
        if (metrics.wordCount < 200) {
            throw new Error(
                "Konten terlalu pendek untuk menghasilkan quiz yang berkualitas",
            );
        }

        // Buat system prompt berdasarkan karakteristik konten
        const systemPrompt = createSystemPrompt(
            language,
            contentType,
            args.targetAudience,
        );

        // Buat user prompt yang disesuaikan
        const userPrompt = createWEBUserPrompt({
            title,
            content,
            metrics,
            contentType,
            language,
            targetAudience: args.targetAudience || "sma",
            focusArea: args.focusArea,
        });

        try {
            const { text: summary } = await generateText({
                model: openrouter(DEFAULT_MODEL),
                system: systemPrompt,
                prompt: userPrompt,
                temperature: 0.2, // Konsistensi tinggi untuk konten edukatif
                maxTokens: 3000,
                topP: 0.9,
                frequencyPenalty: 0.1, // Hindari repetisi
                presencePenalty: 0.1,
            });

            // Validasi dan enhancement rangkuman
            const validatedSummary = validateAndEnhanceSummary(
                summary,
                extractedData,
            );

            if (!validatedSummary) {
                throw new Error(
                    "Rangkuman tidak memenuhi standar kualitas untuk quiz generation",
                );
            }

            // Log untuk monitoring
            console.log(`Rangkuman berhasil dibuat untuk ${args.url}:`, {
                wordCount: metrics.wordCount,
                contentType,
                language,
                summaryLength: validatedSummary.length,
            });

            return {
                summary: validatedSummary,
                metadata: {
                    sourceTitle: title,
                    sourceUrl: args.url,
                    contentType,
                    language,
                    metrics,
                    generatedAt: new Date().toISOString(),
                },
            };
        } catch (apiError) {
            console.error("Error saat memanggil OpenRouter API:", apiError);
            if (apiError instanceof Error) {
                throw new Error(`Gagal menghasilkan rangkuman: ${apiError.message}`);
            }
        }
    },
});

/**
 * Text Summarizer Action - Processes raw text input for educational quiz generation
 *
 * A comprehensive Convex action that handles text prompt summarization pipeline:
 * 1. Validates and cleans the input text
 * 2. Analyzes content for language, type, and metrics
 * 3. Generates learning summary optimized for quiz creation
 * 4. Validates output quality and enhances with metadata
 */
export const textSummarizer = action({
    args: {
        textContent: v.string(),
        targetAudience: v.optional(
            v.union(
                v.literal("smp"),
                v.literal("sma"),
                v.literal("kuliah"),
                v.literal("umum"),
            ),
        ),
        focusArea: v.optional(v.string()),
        title: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        try {
            // Step 1: Validate text content
            if (!args.textContent || args.textContent.trim().length < 20) {
                throw new Error(
                    "Konten teks terlalu pendek. Minimal 20 karakter diperlukan.",
                );
            }

            // Step 3: Analyze content and determine processing type
            const processedContent = analyzeTextContent(
                args.textContent,
                args.title || "Text Content",
            );

            // Enhanced detection logic for prompt vs content
            const isPromptRequest = determineProcessingType(
                args.textContent,
                processedContent.metrics.wordCount,
            );

            let finalContent: string;
            let processingType: "elaboration" | "summarization";

            if (isPromptRequest) {
                // Step 4a: Handle prompt elaboration
                processingType = "elaboration";
                console.log("Detected prompt request, will elaborate content");

                const elaborationPrompt = createElaborationPrompt(
                    args.textContent,
                    args.targetAudience || "sma",
                    args.focusArea || "pembelajaran umum",
                    processedContent.language,
                );

                try {
                    const { text: elaboratedText } = await generateText({
                        model: openrouter(MISTRAL_NEMO_MODEL),
                        system:
                            "You are an educational content creator. Create comprehensive learning material based on user requests. Ensure the content is detailed, structured, and appropriate for educational quiz generation.",
                        prompt: elaborationPrompt,
                        temperature: 0.3,
                        maxTokens: 2000,
                    });

                    finalContent = elaboratedText;

                    // Re-analyze the elaborated content
                    const reanalyzed = analyzeTextContent(
                        finalContent,
                        args.title || "Elaborated Content",
                    );
                    processedContent.content = reanalyzed.content;
                    processedContent.metrics = reanalyzed.metrics;
                    processedContent.contentType = reanalyzed.contentType;
                } catch (elaborationError) {
                    console.error("Error during elaboration:", elaborationError);
                    throw new Error(
                        `Gagal mengembangkan prompt: ${elaborationError instanceof Error ? elaborationError.message : String(elaborationError)}`,
                    );
                }
            } else {
                // Step 4b: Handle content summarization
                processingType = "summarization";
                console.log("Detected content for summarization");

                if (processedContent.metrics.wordCount < 50) {
                    throw new Error(
                        "Konten terlalu pendek untuk dirangkum. Gunakan permintaan yang lebih spesifik atau berikan konten yang lebih panjang.",
                    );
                }

                finalContent = processedContent.content;
            }

            // Step 5: Generate final summary using AI SDK
            const systemPrompt = createSystemPrompt(
                processedContent.language,
                processedContent.contentType,
                args.targetAudience,
            );

            const userPrompt = createTextUserPrompt({
                title: processedContent.title,
                content: finalContent,
                metrics: processedContent.metrics,
                contentType: processedContent.contentType,
                language: processedContent.language,
                targetAudience: args.targetAudience || "sma",
                focusArea: args.focusArea,
            });

            let summary: string;
            try {
                const { text } = await generateText({
                    model: openrouter(DEFAULT_MODEL),
                    system: systemPrompt,
                    prompt: userPrompt,
                    temperature: 0.2,
                    maxTokens: 3000,
                    topP: 0.9,
                    frequencyPenalty: 0.1,
                    presencePenalty: 0.1,
                });

                summary = text;
            } catch (summaryError) {
                console.error("Error during summarization:", summaryError);
                throw new Error(
                    `Gagal menghasilkan rangkuman: ${summaryError instanceof Error ? summaryError.message : String(summaryError)}`,
                );
            }

            // Step 6: Validate summary
            const validatedSummary = validateAndEnhanceSummary(summary, {
                title: processedContent.title,
                content: finalContent,
                metrics: {
                    wordCount: processedContent.metrics.wordCount,
                    headingCount: 0,
                    listItemCount: 0,
                    paragraphCount: finalContent.split("\n\n").length,
                    hasTableOfContents: false,
                    estimatedReadingTime: processedContent.metrics.estimatedReadingTime,
                },
                contentType: processedContent.contentType,
                language: processedContent.language,
            });

            if (!validatedSummary) {
                throw new Error(
                    "Rangkuman tidak memenuhi standar kualitas untuk quiz generation",
                );
            }

            // Step 7: Return enhanced result
            console.log(
                `Text berhasil diproses (${processingType}): ${processedContent.title}`,
                {
                    processingType,
                    originalWordCount: analyzeTextContent(args.textContent).metrics
                        .wordCount,
                    finalWordCount: processedContent.metrics.wordCount,
                    contentType: processedContent.contentType,
                    language: processedContent.language,
                    summaryLength: validatedSummary.length,
                },
            );

            return {
                summary: validatedSummary,
                metadata: {
                    sourceTitle: processedContent.title,
                    contentType: processedContent.contentType,
                    language: processedContent.language,
                    metrics: {
                        wordCount: processedContent.metrics.wordCount,
                        headingCount: 0,
                        listItemCount: 0,
                        paragraphCount: finalContent.split("\n\n").length,
                        hasTableOfContents: false,
                        estimatedReadingTime: processedContent.metrics.estimatedReadingTime,
                    },
                    processingMethod: "text-input",
                    processingType: processingType,
                    originalInput:
                        args.textContent.substring(0, 100) +
                        (args.textContent.length > 100 ? "..." : ""),
                    generatedAt: new Date().toISOString(),
                },
            };
        } catch (error) {
            console.error("Error dalam textSummarizer:", error);
            if (error instanceof Error) {
                throw new Error(`Gagal menghasilkan rangkuman: ${error.message}`);
            }
            throw new Error(`Gagal menghasilkan rangkuman: ${String(error)}`);
        }
    },
});

/**
 * Enhanced logic to determine whether input is a prompt or content to summarize
 */
function determineProcessingType(
    textContent: string,
    wordCount: number,
): boolean {
    const text = textContent.toLowerCase().trim();

    // Criteria for prompt detection
    const isShortText = wordCount < 30;

    // Indonesian prompt indicators
    const indonesianPromptKeywords = [
        "butuh",
        "perlu",
        "mau",
        "ingin",
        "buat",
        "bikin",
        "bantu",
        "soal",
        "pertanyaan",
        "quiz",
        "latihan",
        "kuis",
        "ujian",
        "jelaskan",
        "terangkan",
        "uraikan",
        "bahas",
        "ajarkan",
    ];

    // English prompt indicators
    const englishPromptKeywords = [
        "want",
        "need",
        "create",
        "generate",
        "make",
        "help",
        "question",
        "quiz",
        "practice",
        "exercise",
        "test",
        "explain",
        "describe",
        "discuss",
        "teach",
    ];

    const hasPromptKeywords = [
        ...indonesianPromptKeywords,
        ...englishPromptKeywords,
    ].some((keyword) => text.includes(keyword));

    // Question patterns
    const hasQuestionPattern =
        /^(apa|bagaimana|mengapa|kapan|dimana|siapa|what|how|why|when|where|who)\b/i.test(
            text,
        ) || text.includes("?");

    // Request patterns
    const hasRequestPattern =
        /^(tolong|mohon|please|could you|can you|would you)/i.test(text);

    // Imperative patterns
    const hasImperativePattern =
        /^(buat|bikin|create|generate|make|explain|describe)/i.test(text);

    return (
        isShortText ||
        hasPromptKeywords ||
        hasQuestionPattern ||
        hasRequestPattern ||
        hasImperativePattern
    );
}

/**
 * Create elaboration prompt based on user request and parameters
 */
function createElaborationPrompt(
    originalRequest: string,
    targetAudience: string,
    focusArea: string,
    language: "id" | "en",
): string {
    if (language === "id") {
        return `Berdasarkan permintaan berikut: "${originalRequest}"

Buatlah konten edukatif yang lengkap dan terstruktur dengan minimal 300 kata yang mencakup:

1. **Penjelasan Konsep Dasar**
   - Definisi dan pengertian utama
   - Prinsip-prinsip fundamental

2. **Penjelasan Detail**
   - Karakteristik dan sifat-sifat penting
   - Komponen atau elemen utama
   - Hubungan antar konsep

3. **Contoh Konkret dan Aplikasi**
   - Contoh dalam kehidupan sehari-hari
   - Studi kasus atau ilustrasi praktis
   - Penerapan dalam berbagai situasi

4. **Rumus, Formula, atau Prinsip Kunci**
   - Formula matematika (jika relevan)
   - Aturan atau hukum penting
   - Langkah-langkah prosedural

5. **Poin Penting untuk Quiz**
   - Fakta-fakta kunci yang dapat ditanyakan
   - Konsep yang sering menjadi soal ujian
   - Kesalahan umum yang perlu dihindari

**Target Audience:** ${targetAudience}
**Focus Area:** ${focusArea}

Pastikan konten menggunakan bahasa Indonesia yang jelas, mudah dipahami, dan sesuai dengan tingkat pendidikan target. Struktur penjelasan harus logis dan runtut.`;
    }
    return `Based on this request: "${originalRequest}"

Create comprehensive and structured educational content with minimum 300 words that includes:

1. **Basic Concept Explanations**
   - Main definitions and understanding
   - Fundamental principles

2. **Detailed Explanations**
   - Important characteristics and properties
   - Main components or elements
   - Relationships between concepts

3. **Concrete Examples and Applications**
   - Real-life examples
   - Practical case studies or illustrations
   - Applications in various situations

4. **Formulas, Equations, or Key Principles**
   - Mathematical formulas (if relevant)
   - Important rules or laws
   - Procedural steps

5. **Important Points for Quiz**
   - Key facts that can be questioned
   - Concepts that often become exam questions
   - Common mistakes to avoid

**Target Audience:** ${targetAudience}
**Focus Area:** ${focusArea}

Ensure content uses clear, understandable language appropriate for the target education level. The explanation structure should be logical and systematic.`;
}

/**
 * Zod schema for quiz question structure - matches Convex schema
 */
const QuizQuestionSchema = z.object({
    question: z.string()
        .min(10, "Question must be at least 10 characters")
        .describe("The question text that tests understanding of a concept"),
    options: z
        .array(z.string().min(1, "Option cannot be empty"))
        .min(2, "At least 2 options required")
        .describe("Array of answer choices: 4 options for multiple_choice, 2 for true_false (True/False), or 4-6 for multiple_selection"),
    difficulty: z.enum(["easy", "medium", "hard"])
        .describe("Difficulty level of the question"),
    questionType: z.enum(["multiple_choice", "true_false", "multiple_selection"])
        .describe("Type of question: multiple_choice (one correct answer), true_false (True/False options), or multiple_selection (multiple correct answers)"),
    correctOptionIndex: z
        .number()
        .int()
        .min(0, "Correct option index must be non-negative")
        .describe("Zero-based index of the correct answer for multiple_choice/true_false, or array of indices for multiple_selection"),
    explanation: z.string()
        .min(10, "Explanation must be at least 10 characters")
        .describe("Brief explanation of why the correct answer is right, should be concise but informative"),
});

const QuizResponseSchema = z.object({
    title: z.string().min(1, "Title cannot be empty").describe("The interesting title for the generated quiz"),
    description: z
        .string()
        .min(10, "Description must be at least 10 characters")
        .describe(
            "A concise summary describing the quiz, its focus, and intended audience. Should mention the main topics covered and the difficulty level.",
        ),
    questions: z
        .array(QuizQuestionSchema)
        .min(1, "At least one question required")
        .describe(
            "An array of quiz question objects, each validated against the QuizQuestionSchema. Each question must include the question text, options, correct answer index, explanation, difficulty, and question type.",
        ),
});

/**
 * Quiz Generator Action - Generates quiz questions from summarized content
 *
 * A comprehensive Convex action that creates educational quiz questions based on
 * content summaries from textSummarizer, pdfSummarizer, or websiteSummarizer:
 * 1. Receives summarized content and metadata
 * 2. Creates optimized prompts for quiz question generation
 * 3. Calls OpenRouter API to generate structured quiz questions
 * 4. Validates and formats questions according to schema requirements
 * 5. Returns quiz data ready for database insertion
 *
 * @param summary - The summarized content to generate questions from
 * @param metadata - Content metadata including source info, language, content type
 * @param quizSettings - Quiz configuration (number of questions, difficulty, etc.)
 *
 * @returns Object containing formatted quiz questions and metadata
 *
 * @throws {Error} When API calls fail, parsing fails, or validation fails
 *
 * @example
 * ```typescript
 * const quizData = await ctx.runAction(api.ai.quizGenerator, {
 *   summary: "Physics concepts about Newton's laws...",
 *   metadata: {
 *     sourceTitle: "Physics Fundamentals",
 *     language: "id",
 *     contentType: "academic"
 *   },
 *   quizSettings: {
 *     numQuestions: 5,
 *     difficulty: "medium",
 *     questionTypes: ["multiple_choice"]
 *   }
 * });
 * ```
 */
export const quizGenerator = action({
    args: {
        summary: v.string(),
        metadata: v.object({
            sourceTitle: v.string(),
            sourceUrl: v.optional(v.string()),
            contentType: v.string(),
            language: v.union(v.literal("id"), v.literal("en")),
            processingMethod: v.optional(v.string()),
            processingType: v.optional(v.string()),
            originalInput: v.optional(v.string()),
            generatedAt: v.string(),
        }),
        quizSettings: v.object({
            numQuestions: v.optional(v.number()),
            difficulty: v.optional(
                v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"), v.literal("mix")),
            ),
            targetAudience: v.optional(
                v.union(
                    v.literal("smp"),
                    v.literal("sma"),
                    v.literal("kuliah"),
                    v.literal("umum"),
                ),
            ),
            focusArea: v.optional(v.string()),
        }),
    },
    handler: async (ctx, args) => {
        try {
            const { summary, metadata, quizSettings } = args;

            // Extract settings with defaults
            const numQuestions = quizSettings.numQuestions || 5;
            const difficulty = quizSettings.difficulty || "mix";
            const questionTypes = ["multiple_choice", "true_false", "multiple_selection"]; // Always use mixed question types
            const targetAudience = quizSettings.targetAudience || "sma";
            const language = metadata.language;

            // Create system prompt for quiz generation
            const systemPrompt = `You are an expert educational quiz designer specializing in creating high-quality questions from academic content.

Your task is to generate ${numQuestions} quiz questions with ${difficulty} difficulty level for ${targetAudience} students.

Question Types to Generate:
${questionTypes.includes("multiple_choice") ? "- Multiple Choice: Provide exactly 4 options with only one correct answer" : ""}
${questionTypes.includes("true_false") ? "- True/False: Provide 2 options ('True' and 'False')" : ""}
${questionTypes.includes("multiple_selection") ? "- Multiple Selection: Provide 4-6 options with multiple correct answers" : ""}

CRITICAL REQUIREMENTS:
1. Respond with ONLY a valid JSON object matching the required schema
2. Use ${language === "id" ? "Indonesian" : "English"} language throughout
3. Ensure questions test understanding, not just memorization
4. Make distractors plausible but clearly incorrect
5. Keep explanations concise but informative

Example format:
{
  "title": "French Geography Quiz",
  "description": "A quiz about French geography covering basic facts about the country's major cities and landmarks.",
  "questions": [
    {
      "question": "What is the capital of France?",
      "options": ["Berlin", "Madrid", "Paris", "Rome"],
      "correctOptionIndex": 2,
      "explanation": "Paris is the capital and largest city of France.",
      "difficulty": "easy",
      "questionType": "multiple_choice"
    }
  ]
}`;

            // Create user prompt with the summary content
            const userPrompt = `
Source Material: "${metadata.sourceTitle}"
Content Type: ${metadata.contentType}
Target Audience: ${targetAudience}
${quizSettings.focusArea ? `Focus Area: ${quizSettings.focusArea}` : ""}

Summary Content to Create Quiz From:
---
${summary}
---

Generate ${numQuestions} quiz questions based on this content. Distribute question types as follows:
${questionTypes.map((type) => `- ${type}: ${Math.ceil(numQuestions / questionTypes.length)} questions`).join("\n")}

Ensure questions cover the main concepts and are appropriate for the ${difficulty} difficulty level.
Remember to respond with ONLY the JSON array of question objects.`;

            // Call OpenRouter API for quiz generation using AI SDK with generateObject
            console.log(
                `Generating ${numQuestions} quiz questions for: ${metadata.sourceTitle}`,
            );

            const { object: quizData } = await generateObject({
                model: openrouter(DEFAULT_MODEL),
                system: systemPrompt,
                prompt: userPrompt,
                schema: QuizResponseSchema,
                temperature: 0.4, // Balanced creativity for question variety
                maxTokens: 3000,
                topP: 0.9,
                frequencyPenalty: 0.3, // Encourage question variety
                presencePenalty: 0.1,
            });

            // Validate that we received questions
            if (!quizData.questions || quizData.questions.length === 0) {
                throw new Error("No questions generated");
            }

            // Additional validation for correctOptionIndex bounds
            for (let i = 0; i < quizData.questions.length; i++) {
                const question = quizData.questions[i];
                if (question.correctOptionIndex >= question.options.length) {
                    throw new Error(
                        `Question ${i + 1}: correctOptionIndex (${question.correctOptionIndex}) exceeds options length (${question.options.length})`,
                    );
                }
            }

            console.log(
                `Successfully generated ${quizData.questions.length} quiz questions for "${metadata.sourceTitle}"`,
            );

            return {
                title: quizData.title,
                questions: quizData.questions,
                description: quizData.description,
                metadata: {
                    sourceTitle: metadata.sourceTitle,
                    sourceUrl: metadata.sourceUrl,
                    totalQuestions: quizData.questions.length,
                    difficulty,
                    questionTypes,
                    targetAudience,
                    language,
                    generatedAt: new Date().toISOString(),
                },
            };
        } catch (error) {
            console.error("Error in quizGenerator:", error);
            if (error instanceof Error) {
                throw new Error(`Failed to generate quiz: ${error.message}`);
            }
            throw new Error(`Failed to generate quiz: ${String(error)}`);
        }
    },
});
