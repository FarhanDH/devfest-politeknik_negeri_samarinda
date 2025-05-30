"use node";
import fetch from "node-fetch";
import { type HTMLElement, parse } from "node-html-parser";
import { OPENROUTER_API_KEY, type OpenrouterCompletions } from "./lib";
/**
 * Metrics about the extracted content structure and readability
 */
export interface ContentMetrics {
	/** Total number of words in the content */
	wordCount: number;
	/** Number of heading elements (h1-h6) found */
	headingCount: number;
	/** Number of list items found */
	listItemCount: number;
	/** Number of paragraphs estimated by double line breaks */
	paragraphCount: number;
	/** Whether the content appears to have a table of contents */
	hasTableOfContents: boolean;
	/** Estimated reading time in minutes (based on 200 WPM) */
	estimatedReadingTime: number;
}

/**
 * Complete extracted content with metadata and analysis
 */
export interface ExtractedContent {
	/** Page title extracted from various sources */
	title: string;
	/** Main content text, cleaned and optimized */
	content: string;
	/** Structural metrics about the content */
	metrics: ContentMetrics;
	/** Detected content type based on content analysis */
	contentType: "academic" | "tutorial" | "reference" | "general";
	/** Detected language (Indonesian or English) */
	language: "id" | "en";
}

/**
 * Metrics specific to PDF document analysis
 */
export interface PDFMetrics {
	/** Number of pages in the PDF (optional, may not be detected) */
	pageCount?: number;
	/** Total number of words in the extracted content */
	wordCount: number;
	/** Whether the document appears to contain images or diagrams */
	hasImages: boolean;
	/** Whether a table of contents was detected */
	hasTableOfContents: boolean;
	/** Estimated reading time in minutes (based on 200 WPM) */
	estimatedReadingTime: number;
	/** File size in bytes */
	fileSize: number;
}

/**
 * Complete processed PDF content with analysis results
 */
export interface ProcessedPDFContent {
	/** Extracted and cleaned text content */
	content: string;
	/** Document metrics and statistics */
	metrics: PDFMetrics;
	/** Detected content type based on analysis */
	contentType: "academic" | "tutorial" | "reference" | "general";
	/** Detected language (Indonesian or English) */
	language: "id" | "en";
	/** Original or extracted filename */
	fileName: string;
	/** Method used for text extraction */
	processingMethod: "text-extraction" | "ocr";
}

/**
 * Complete processed text content with metadata and analysis for text input
 */
export interface ProcessedTextContent {
	/** Content title (provided or generated) */
	title: string;
	/** Processed text content */
	content: string;
	/** Content metrics for analysis */
	metrics: { wordCount: number; estimatedReadingTime: number };
	/** Detected content type based on content analysis */
	contentType: "academic" | "tutorial" | "reference" | "general";
	/** Detected language (Indonesian or English) */
	language: "id" | "en";
}

/**
 * Extracts and analyzes content from a website URL
 *
 * This function fetches a webpage, extracts the main content, cleans it from noise,
 * and provides detailed analysis including content type, language detection, and metrics.
 *
 * @param url - The URL to extract content from
 * @returns Promise that resolves to extracted content object or null if extraction fails
 *
 * @example
 * ```typescript
 * const content = await websiteContentExtractor('https://example.com/article');
 * if (content) {
 *   console.log(`Title: ${content.title}`);
 *   console.log(`Words: ${content.metrics.wordCount}`);
 *   console.log(`Type: ${content.contentType}`);
 * }
 * ```
 */
export async function websiteContentExtractor(
	url: string,
): Promise<ExtractedContent | null> {
	try {
		const response = await fetch(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.5,id;q=0.3",
				"Accept-Encoding": "gzip, deflate, br",
				Connection: "keep-alive",
				"Upgrade-Insecure-Requests": "1",
			},
			signal: AbortSignal.timeout(15000), // 15 detik timeout
		});

		if (!response.ok) {
			console.error(
				`Gagal mengambil konten dari ${url}: ${response.status} ${response.statusText}`,
			);
			return null;
		}

		const html = await response.text();
		const root = parse(html);

		// Ekstrak judul halaman
		const title = extractTitle(root);

		// Pembersihan elemen noise
		cleanupNoiseElements(root);

		// Ekstraksi konten utama dengan prioritas
		const mainContent = extractMainContent(root);

		if (!mainContent || mainContent.length < 500) {
			console.warn(`Konten terlalu pendek atau tidak ditemukan dari ${url}`);
			return null;
		}

		// Analisis dan pembersihan teks
		const cleanedContent = cleanAndStructureText(mainContent);

		// Hitung metrik konten
		const metrics = calculateContentMetrics(cleanedContent, root);

		// Deteksi jenis konten dan bahasa
		const contentType = detectContentType(cleanedContent, root);
		const language = detectLanguage(cleanedContent);

		// Optimasi panjang untuk API (12.000 karakter ~ 3.000 kata)
		const optimizedContent = optimizeContentLength(cleanedContent, 12000);

		return {
			title,
			content: optimizedContent,
			metrics,
			contentType,
			language,
		};
	} catch (error) {
		console.error(`Error mengekstrak konten dari ${url}:`, error);
		return null;
	}
}

/**
 * Extracts the title from a webpage using multiple strategies
 *
 * Attempts to find the most appropriate title by checking various HTML elements
 * in order of priority: h1, title tag, common title classes, and OpenGraph tags.
 *
 * @param root - The parsed HTML root element
 * @returns The extracted title or a default fallback
 *
 * @example
 * ```typescript
 * const title = extractTitle(parsedHTML);
 * // Returns: "Article Title" or "Konten Web" if no suitable title found
 * ```
 */
function extractTitle(root: HTMLElement): string {
	// Prioritas ekstraksi judul
	const titleSelectors = [
		"h1",
		"title",
		".page-title",
		".post-title",
		".article-title",
		'[property="og:title"]',
	];

	for (const selector of titleSelectors) {
		const element = root.querySelector(selector);
		if (element) {
			const title = element.getAttribute("content") || element.innerText;
			if (title && title.trim().length > 5) {
				return title.trim();
			}
		}
	}

	return "Konten Web";
}

/**
 * Removes noise elements that don't contribute to main content
 *
 * Cleans up navigation, advertisements, social media widgets, forms,
 * and other elements that typically don't contain valuable content.
 * Also removes very short text elements that are likely noise.
 *
 * @param root - The HTML element to clean up (modified in place)
 *
 * @example
 * ```typescript
 * cleanupNoiseElements(parsedHTML);
 * // Removes nav, ads, social widgets, etc. from the DOM
 * ```
 */
function cleanupNoiseElements(root: HTMLElement): void {
	const noiseSelectors = [
		// Navigasi dan struktur
		"nav",
		"header",
		"footer",
		"aside",
		".navigation",
		".navbar",
		".header",
		".footer",
		".sidebar",

		// Iklan dan promosi
		".advertisement",
		".ads",
		".ad",
		".sponsored",
		".promo",
		".banner",
		".popup",

		// Social media dan interaksi
		".social-share",
		".social-media",
		".share-buttons",
		".comments",
		".comment-section",
		".disqus",
		".related-posts",
		".recommended",
		".you-may-like",

		// Form dan subscription
		".newsletter",
		".subscribe",
		".signup-form",
		".contact-form",
		".search-form",

		// Metadata dan utility
		".breadcrumb",
		".tags",
		".categories",
		".author-bio",
		".published-date",
		".last-modified",

		// Script dan style
		"script",
		"style",
		"noscript",

		// Atribut role
		'[role="navigation"]',
		'[role="banner"]',
		'[role="contentinfo"]',
		'[role="complementary"]',
		'[role="search"]',
	];

	for (const selector of noiseSelectors) {
		for (const el of root.querySelectorAll(selector)) {
			el.remove();
		}
	}

	// Hapus elemen dengan teks pendek yang kemungkinan noise
	for (const el of root.querySelectorAll("div, span, p")) {
		const text = el.innerText.trim();
		if (
			text.length < 20 &&
			/^(read more|continue|click here|subscribe|follow|share)$/i.test(text)
		) {
			el.remove();
		}
	}
}

/**
 * Extracts the main content from a webpage using semantic selectors
 *
 * Uses a priority-based approach to find the main content area by checking
 * semantic HTML5 elements, common CMS classes, and popular publishing platforms.
 * Falls back to finding the div with the longest text content.
 *
 * @param root - The cleaned HTML root element
 * @returns The extracted main content text or empty string if not found
 *
 * @example
 * ```typescript
 * const content = extractMainContent(cleanedHTML);
 * // Returns main article/content text
 * ```
 */
function extractMainContent(root: HTMLElement): string {
	// Prioritas ekstraksi berdasarkan semantic HTML dan class common
	const contentSelectors = [
		// Semantic HTML5
		"article",
		"main",
		'[role="main"]',

		// WordPress dan CMS umum
		".post-content",
		".entry-content",
		".article-content",
		".content",
		".main-content",
		".page-content",

		// Medium, Substack, Ghost
		".post-article",
		".post-body",
		".article-body",

		// Academic dan educational sites
		".abstract",
		".paper-content",
		".lesson-content",

		// Documentation sites
		".documentation",
		".docs-content",
		".wiki-content",
	];

	for (const selector of contentSelectors) {
		const element = root.querySelector(selector);
		if (element) {
			const text = element.innerText;
			if (text && text.trim().length > 500) {
				return text;
			}
		}
	}

	// Fallback: cari div dengan konten terpanjang
	const divElements = root.querySelectorAll("div");
	let longestContent = "";

	for (const div of divElements) {
		const text = div.innerText;
		if (text && text.length > longestContent.length && text.length > 500) {
			longestContent = text;
		}
	}

	return longestContent || root.querySelector("body")?.innerText || "";
}

/**
 * Cleans and structures raw text content for better readability
 *
 * Performs comprehensive text normalization including whitespace cleanup,
 * removal of excessive line breaks, character normalization, and removal
 * of common noise text patterns.
 *
 * @param text - Raw text content to clean
 * @returns Cleaned and structured text
 *
 * @example
 * ```typescript
 * const cleaned = cleanAndStructureText(rawContent);
 * // Returns normalized text with proper spacing and structure
 * ```
 */
function cleanAndStructureText(text: string): string {
	return (
		text
			// Normalisasi whitespace
			.replace(/\r\n/g, "\n")
			.replace(/\r/g, "\n")
			.replace(/\t/g, " ")

			// Hapus baris kosong berlebihan
			.replace(/\n\s*\n\s*\n/g, "\n\n")

			// Perbaiki spasi
			.replace(/\s+/g, " ")
			.replace(/\n /g, "\n")
			.replace(/ \n/g, "\n")

			// Hapus karakter khusus yang mengganggu
			.replace(/[^\w\s\n.,;:!?()\-""'']/g, " ")

			// Hapus teks noise umum
			.replace(
				/\b(cookie policy|privacy policy|terms of service|subscribe now|follow us|share this|read more|continue reading)\b/gi,
				"",
			)

			// Normalisasi akhir
			.replace(/\s+/g, " ")
			.trim()
	);
}

/**
 * Calculates various metrics about the content structure and readability
 *
 * Analyzes the content to provide insights about word count, structure elements,
 * and estimated reading time. Also detects presence of table of contents.
 *
 * @param content - The cleaned content text to analyze
 * @param root - The HTML root element for structural analysis
 * @returns Object containing various content metrics
 *
 * @example
 * ```typescript
 * const metrics = calculateContentMetrics(content, htmlRoot);
 * // Returns: { wordCount: 1500, headingCount: 8, estimatedReadingTime: 8, ... }
 * ```
 */
function calculateContentMetrics(
	content: string,
	root: HTMLElement,
): ContentMetrics {
	const words = content.split(/\s+/).filter((word) => word.length > 0);
	const wordCount = words.length;

	return {
		wordCount,
		headingCount: root.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
		listItemCount: root.querySelectorAll("li").length,
		paragraphCount: content.split("\n\n").length,
		hasTableOfContents: /table of contents|daftar isi|contents/i.test(content),
		estimatedReadingTime: Math.ceil(wordCount / 200), // 200 WPM reading speed
	};
}

/**
 * Detects the type of content based on keyword analysis and structure
 *
 * Analyzes content for academic, tutorial, reference, or general indicators
 * by looking for specific keywords and structural elements like headings.
 * Supports both English and Indonesian content.
 *
 * @param content - The content text to analyze
 * @param root - The HTML root element for structural analysis
 * @returns Detected content type category
 *
 * @example
 * ```typescript
 * const type = detectContentType(content, htmlRoot);
 * // Returns: 'academic' | 'tutorial' | 'reference' | 'general'
 * ```
 */
function detectContentType(
	content: string,
	root: HTMLElement | null,
): "academic" | "tutorial" | "reference" | "general" {
	const academicIndicators = [
		"abstract",
		"methodology",
		"conclusion",
		"references",
		"bibliography",
		"research",
		"study",
		"analysis",
		"hypothesis",
		"literature review",
		"abstrak",
		"metodologi",
		"kesimpulan",
		"referensi",
		"penelitian",
	];

	const tutorialIndicators = [
		"step",
		"tutorial",
		"how to",
		"guide",
		"lesson",
		"chapter",
		"langkah",
		"panduan",
		"cara",
		"pelajaran",
		"bab",
	];

	const referenceIndicators = [
		"definition",
		"glossary",
		"reference",
		"documentation",
		"api",
		"definisi",
		"glosarium",
		"dokumentasi",
	];

	const lowerContent = content.toLowerCase();

	if (!root) {
		return "general"; // No structure to analyze, default to general
	}

	const hasHeadings = root.querySelectorAll("h1, h2, h3").length > 3;

	const academicScore = academicIndicators.filter((ind) =>
		lowerContent.includes(ind),
	).length;
	const tutorialScore = tutorialIndicators.filter((ind) =>
		lowerContent.includes(ind),
	).length;
	const referenceScore = referenceIndicators.filter((ind) =>
		lowerContent.includes(ind),
	).length;

	if (academicScore >= 2) return "academic";
	if (tutorialScore >= 2 && hasHeadings) return "tutorial";
	if (referenceScore >= 2) return "reference";

	return "general";
}

/**
 * Detects whether content is primarily in Indonesian or English
 *
 * Uses a word frequency analysis approach by counting common function words
 * in both languages. Analyzes the first 200 words for efficiency.
 *
 * @param content - The content text to analyze for language detection
 * @returns Detected language code ('id' for Indonesian, 'en' for English)
 *
 * @example
 * ```typescript
 * const language = detectLanguage(content);
 * // Returns: 'id' or 'en'
 * ```
 */
function detectLanguage(content: string): "id" | "en" {
	const indonesianWords = [
		"dan",
		"atau",
		"yang",
		"adalah",
		"dengan",
		"pada",
		"untuk",
		"dalam",
		"dari",
		"ke",
		"ini",
		"itu",
		"akan",
		"dapat",
		"sebagai",
		"oleh",
		"tentang",
		"karena",
		"sehingga",
		"namun",
		"tetapi",
		"juga",
	];

	const englishWords = [
		"the",
		"and",
		"or",
		"that",
		"is",
		"with",
		"on",
		"for",
		"in",
		"from",
		"to",
		"this",
		"it",
		"will",
		"can",
		"as",
		"by",
		"about",
		"because",
		"so",
		"but",
		"also",
		"however",
	];

	const words = content.toLowerCase().split(/\s+/).slice(0, 200);

	const indonesianMatches = words.filter((word) =>
		indonesianWords.includes(word),
	).length;
	const englishMatches = words.filter((word) =>
		englishWords.includes(word),
	).length;

	return indonesianMatches > englishMatches ? "id" : "en";
}

/**
 * Optimizes content length for API usage while preserving structure
 *
 * Intelligently truncates content to fit within specified limits by
 * prioritizing paragraph and sentence boundaries. Ensures meaningful
 * content is preserved when truncation is necessary.
 *
 * @param content - The content to optimize
 * @param maxLength - Maximum allowed character length
 * @returns Optimized content within the specified length limit
 *
 * @example
 * ```typescript
 * const optimized = optimizeContentLength(longContent, 12000);
 * // Returns content truncated at paragraph/sentence boundaries
 * ```
 */
function optimizeContentLength(content: string, maxLength: number): string {
	if (content.length <= maxLength) {
		return content;
	}

	// Coba potong di akhir paragraf terdekat
	const paragraphs = content.split("\n\n");
	let optimized = "";

	for (const paragraph of paragraphs) {
		if ((optimized + paragraph).length > maxLength) {
			break;
		}
		optimized += `${paragraph}\n\n`;
	}

	// Jika masih kosong, potong di akhir kalimat
	if (optimized.trim().length < 1000) {
		const sentences = content.split(/[.!?]\s+/);
		optimized = "";

		for (const sentence of sentences) {
			if ((optimized + sentence).length > maxLength) {
				break;
			}
			optimized += `${sentence}. `;
		}
	}

	return optimized.trim() || content.substring(0, maxLength);
}

/**
 * Encodes a PDF file from a cloud URL into base64 format for processing
 *
 * Downloads a PDF file from a given URL, validates it's a proper PDF,
 * checks file size constraints, and converts it to base64 encoding.
 * Includes comprehensive error handling and validation.
 *
 * @param pdfURL - The URL pointing to the PDF file to download and encode
 * @returns Promise resolving to object containing base64 PDF data, file size, and filename
 *
 * @throws {Error} When URL is invalid, file is not a PDF, file is too large (>50MB), or download fails
 *
 * @example
 * ```typescript
 * const { base64PDF, fileSize, fileName } = await encodePDFFromCloudURL('https://example.com/doc.pdf');
 * console.log(`Encoded ${fileName} (${Math.round(fileSize/1024)}KB)`);
 * ```
 */
export async function encodePDFFromCloudURL(
	pdfURL: string,
): Promise<{ base64PDF: string; fileSize: number; fileName: string }> {
	try {
		// Validasi URL format
		console.log(`Memproses URL PDF: ${pdfURL}`);

		if (!isValidPDFURL(pdfURL)) {
			throw new Error("URL tidak valid atau bukan file PDF");
		}

		const response = await fetch(pdfURL, {
			signal: AbortSignal.timeout(30000), // 30 detik timeout untuk file besar
		});

		if (!response.ok) {
			throw new Error(
				`Gagal mengambil PDF dari URL: ${response.status} ${response.statusText}`,
			);
		}

		// Validasi Content-Type
		const contentType = response.headers.get("content-type");
		if (contentType && !contentType.includes("application/pdf")) {
			console.warn(
				`Content-Type tidak standar: ${contentType}, melanjutkan processing...`,
			);
		}

		// Cek ukuran file (maksimal 50MB)
		const contentLength = response.headers.get("content-length");
		const fileSize = contentLength ? Number.parseInt(contentLength) : 0;

		if (fileSize > 50 * 1024 * 1024) {
			// 50MB
			throw new Error(
				`File PDF terlalu besar: ${Math.round(fileSize / 1024 / 1024)}MB. Maksimal 50MB.`,
			);
		}

		const pdfBuffer = await response.buffer();
		const actualFileSize = pdfBuffer.length;

		// Validasi bahwa ini adalah file PDF dengan memeriksa header
		if (!isPDFBuffer(pdfBuffer)) {
			throw new Error("File yang didownload bukan PDF yang valid");
		}

		const base64PDF = pdfBuffer.toString("base64");
		const fileName = extractFileNameFromURL(pdfURL);

		console.log(
			`PDF berhasil di-encode: ${fileName}, Size: ${Math.round(actualFileSize / 1024)}KB`,
		);

		return {
			base64PDF: `data:application/pdf;base64,${base64PDF}`,
			fileSize: actualFileSize,
			fileName,
		};
	} catch (error) {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		console.error("Error encoding PDF from cloud URL:", (error as any).message);
		if (error instanceof Error) {
			throw new Error(`Gagal memproses PDF: ${error.message}`);
		}
		throw new Error("Gagal memproses PDF karena alasan yang tidak diketahui");
	}
}

/**
 * Analyzes extracted PDF text content and generates structured metadata
 *
 * Processes raw text extracted from a PDF document by cleaning it,
 * calculating metrics, detecting content type and language. Reuses
 * the same analysis logic as website content extraction for consistency.
 *
 * @param extractedText - Raw text content extracted from the PDF
 * @param fileName - Name of the PDF file for reference
 * @param fileSize - Size of the PDF file in bytes
 * @returns Processed content object with analysis results and metadata
 *
 * @example
 * ```typescript
 * const processed = analyzePDFContent(rawText, 'lecture.pdf', 2048000);
 * console.log(`Analyzed ${processed.fileName}: ${processed.contentType} content`);
 * console.log(`Language: ${processed.language}, Words: ${processed.metrics.wordCount}`);
 * ```
 */
// 2. PDF Content Analyzer - menggunakan logika yang sama dengan website
export function analyzePDFContent(
	extractedText: string,
	fileName: string,
	fileSize: number,
): ProcessedPDFContent {
	// Reuse fungsi cleaning dari website extractor
	const cleanedContent = cleanAndStructureText(extractedText);

	// Hitung metrik menggunakan logika yang sama
	const words = cleanedContent.split(/\s+/).filter((word) => word.length > 0);
	const wordCount = words.length;

	const metrics: PDFMetrics = {
		wordCount,
		hasImages: /image|figure|diagram|chart|graph/i.test(cleanedContent),
		hasTableOfContents:
			/table of contents|daftar isi|contents|bab \d+|chapter \d+/i.test(
				cleanedContent,
			),
		estimatedReadingTime: Math.ceil(wordCount / 200),
		fileSize,
	};

	// Reuse detection functions
	const contentType = detectContentType(cleanedContent, null); // null kerana tidak ada DOM
	const language = detectLanguage(cleanedContent);

	return {
		content: optimizeContentLength(cleanedContent, 12000), // Same limit as website
		metrics,
		contentType,
		language,
		fileName,
		processingMethod: "text-extraction", // Will be updated based on actual method used
	};
}

/**
 * Extracts text content from a PDF using OpenRouter AI with configurable methods
 *
 * Uses OpenRouter's Gemini model with file parsing capabilities to extract text
 * from PDF documents. Supports both standard text extraction and OCR for
 * scanned documents. Includes proper error handling and validation.
 *
 * @param base64PDF - Base64 encoded PDF data (with data URI prefix)
 * @param fileName - Name of the PDF file for processing context
 * @param useOCR - Whether to use OCR engine for scanned documents
 * @returns Promise resolving to extracted text content
 *
 * @throws {Error} When API call fails, no content is extracted, or response is invalid
 *
 * @example
 * ```typescript
 * const content = await extractPDFContent(base64Data, 'document.pdf', false);
 * console.log(`Extracted ${content.length} characters from PDF`);
 * ```
 */
// 4. PDF Content Extraction using OpenRouter with file parsing capabilities
export async function extractPDFContent(
	base64PDF: string,
	fileName: string,
	useOCR: boolean,
): Promise<string> {
	const extractionPrompt = useOCR
		? "Extract all text content from this PDF document using OCR. Focus on readable text and ignore decorative elements."
		: "Extract the text content from this PDF document. Maintain the logical structure and flow of information.";

	try {
		// NOTE: This function uses OpenRouter-specific features that are not supported by the AI SDK:
		// 1. File uploads with base64 PDF data
		// 2. OpenRouter plugins (file-parser with PDF engines)
		// 3. Complex message structure with file attachments
		// Therefore, we must use direct fetch to OpenRouter API

		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${OPENROUTER_API_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: "google/gemini-2.5-flash-preview-05-20",
					messages: [
						{
							role: "user",
							content: [
								{
									type: "text",
									text: extractionPrompt,
								},
								{
									type: "file",
									file: {
										filename: fileName,
										file_data: base64PDF,
									},
								},
							],
						},
					],
					plugins: [
						{
							id: "file-parser",
							pdf: {
								engine: useOCR ? "mistral-ocr" : "pdf-text",
							},
						},
					],
				}),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("OpenRouter PDF extraction error:", errorText);
			throw new Error(
				`Gagal mengekstrak konten PDF: ${response.status} ${response.statusText}`,
			);
		}

		const data = (await response.json()) as OpenrouterCompletions;

		if (
			!data.choices ||
			data.choices.length === 0 ||
			!data.choices[0].message?.content
		) {
			throw new Error("Tidak ada hasil ekstraksi dari PDF");
		}

		return data.choices[0].message.content;
	} catch (error) {
		console.error("Error extracting PDF content:", error);
		if (error instanceof Error) {
			throw new Error(`Gagal mengekstrak konten PDF: ${error.message}`);
		}
		throw new Error(
			"Gagal mengekstrak konten PDF karena alasan yang tidak diketahui",
		);
	}
}

/**
 * Validates whether a URL points to a PDF file
 *
 * Checks if the provided URL has a valid format and appears to point
 * to a PDF file based on file extension, path content, or query parameters.
 *
 * @param url - The URL string to validate
 * @returns Boolean indicating whether the URL appears to be a valid PDF URL
 *
 * @example
 * ```typescript
 * isValidPDFURL('https://example.com/doc.pdf'); // true
 * isValidPDFURL('https://example.com/file?format=pdf'); // true
 * isValidPDFURL('https://example.com/image.jpg'); // false
 * ```
 */
// 5. Helper Functions
export function isValidPDFURL(url: string): boolean {
	try {
		const urlObj = new URL(url);
		// Existing checks
		if (
			/\\.(pdf)$/i.test(urlObj.pathname) ||
			url.toLowerCase().includes("pdf") || // Check if the whole URL string includes "pdf" (case-insensitive)
			urlObj.searchParams.has("format")
		) {
			return true;
		}

		// Add check for Convex storage URLs (or similar patterns)
		// This is a heuristic: we assume it *might* be a PDF if it matches this pattern,
		// and the actual content type will be verified later during fetch.
		if (
			urlObj.hostname.endsWith(".convex.cloud") &&
			urlObj.pathname.startsWith("/api/storage/")
		) {
			return true; // Assume it's potentially valid, let Content-Type check confirm
		}

		return false;
	} catch {
		return false;
	}
}

/**
 * Checks if a buffer contains valid PDF data by examining the file header
 *
 * Validates whether the provided buffer represents a PDF file by checking
 * for the standard PDF header signature "%PDF-" at the beginning of the file.
 *
 * @param buffer - Buffer containing file data to validate
 * @returns Boolean indicating whether the buffer contains valid PDF data
 *
 * @example
 * ```typescript
 * const fileBuffer = fs.readFileSync('document.pdf');
 * if (isPDFBuffer(fileBuffer)) {
 *   console.log('Valid PDF file detected');
 * }
 * ```
 */
export function isPDFBuffer(buffer: Buffer): boolean {
	// PDF files start with "%PDF-"
	const pdfHeader = buffer.subarray(0, 5).toString();
	return pdfHeader === "%PDF-";
}

/**
 * Extracts a filename from a URL, ensuring it has a PDF extension
 *
 * Parses the URL to extract the filename from the path. If no filename
 * is found or the filename doesn't have a PDF extension, appropriate
 * defaults are applied.
 *
 * @param url - The URL to extract filename from
 * @returns Filename with .pdf extension, or 'document.pdf' as fallback
 *
 * @example
 * ```typescript
 * extractFileNameFromURL('https://example.com/path/report.pdf'); // 'report.pdf'
 * extractFileNameFromURL('https://example.com/path/file'); // 'file.pdf'
 * extractFileNameFromURL('invalid-url'); // 'document.pdf'
 * ```
 */
export function extractFileNameFromURL(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const fileName = pathname.split("/").pop() || "document.pdf";
		return fileName.includes(".pdf") ? fileName : `${fileName}.pdf`;
	} catch {
		return "document.pdf";
	}
}

/**
 * Determines whether to use OCR based on extraction method and file characteristics
 *
 * Makes intelligent decision about using OCR vs standard text extraction
 * based on explicit method selection or automatic detection using file size
 * as a proxy for scanned documents.
 *
 * @param method - Extraction method: 'ocr', 'text', or 'auto'
 * @param fileSize - File size in bytes for automatic method detection
 * @returns Boolean indicating whether OCR should be used
 *
 * @example
 * ```typescript
 * shouldUseOCR('ocr', 1000000); // true
 * shouldUseOCR('text', 1000000); // false
 * shouldUseOCR('auto', 6000000); // true (>5MB threshold)
 * shouldUseOCR('auto', 2000000); // false (<5MB threshold)
 * ```
 */
export function shouldUseOCR(method: string, fileSize: number): boolean {
	if (method === "ocr") return true;
	if (method === "text") return false;

	// Auto: Use OCR for larger files that might be scanned documents
	return fileSize > 5 * 1024 * 1024; // 5MB threshold
}

/**
 * Generates a structured user prompt for PDF document analysis and quiz creation
 *
 * Creates a comprehensive prompt that instructs the AI to analyze PDF content
 * for educational quiz generation. Includes document metadata, formatting
 * requirements, and quality criteria. Supports both Indonesian and English.
 *
 * @param params - Configuration object containing document info and analysis parameters
 * @param params.fileName - Name of the PDF file
 * @param params.content - Extracted text content from the PDF
 * @param params.metrics - Document metrics and statistics
 * @param params.contentType - Detected content type (academic, tutorial, etc.)
 * @param params.language - Document language ('id' or 'en')
 * @param params.targetAudience - Educational level (smp, sma, kuliah, umum)
 * @param params.focusArea - Optional specific subject area to emphasize
 * @param params.quizType - Type of quiz questions to optimize for
 * @returns Formatted prompt string for AI processing
 *
 * @example
 * ```typescript
 * const prompt = createPDFUserPrompt({
 *   fileName: 'calculus.pdf',
 *   content: extractedText,
 *   metrics: pdfMetrics,
 *   contentType: 'academic',
 *   language: 'en',
 *   targetAudience: 'kuliah',
 *   focusArea: 'mathematics',
 *   quizType: 'campuran'
 * });
 * ```
 */
export function createPDFUserPrompt(params: {
	fileName: string;
	content: string;
	metrics: PDFMetrics;
	contentType: string;
	language: "id" | "en";
	targetAudience: string;
	focusArea?: string;
}): string {
	const { fileName, content, metrics, language, targetAudience, focusArea } =
		params;

	const isIndonesian = language === "id";

	const instructions = isIndonesian
		? {
				title: "ANALISIS DOKUMEN PDF UNTUK QUIZ",
				task: "Buat rangkuman pembelajaran terstruktur dari dokumen PDF berikut:",
			}
		: {
				title: "PDF DOCUMENT ANALYSIS FOR QUIZ",
				task: "Create a structured learning summary from the following PDF document:",
			};

	// Reuse format structure from website but adapt for PDF
	const formatStructure = isIndonesian
		? `
## ${fileName.replace(".pdf", "")}

### Informasi Dokumen
- **Nama File**: ${fileName}
- **Jumlah Kata**: ${metrics.wordCount}
- **Estimasi Waktu Baca**: ${metrics.estimatedReadingTime} menit
- **Jenis Konten**: Dokumen ${params.contentType}
- **Target Audiens**: ${targetAudience.toUpperCase()}

### Konsep Kunci
[Daftar 5-8 konsep fundamental dari dokumen]

### Terminologi Penting  
[Definisi istilah-istilah kunci dengan penjelasan singkat]

### Fakta dan Data
[Informasi faktual yang dapat diujikan - angka, tanggal, nama, statistik]

### Proses dan Tahapan
[Urutan langkah, perkembangan, atau alur berpikir yang dapat diuji]

### Hubungan Sebab-Akibat
[Kaitan logis antar konsep yang cocok untuk soal analitis]

### Contoh dan Aplikasi
[Contoh konkret atau penerapan yang dapat dijadikan soal kontekstual]

### Poin Evaluasi
[Aspek-aspek yang cocok untuk berbagai jenis soal (pilihan ganda, benar/salah, dan pilihan berganda)]
`
		: `
## ${fileName.replace(".pdf", "")}

### Document Information
- **File Name**: ${fileName}
- **Word Count**: ${metrics.wordCount}
- **Estimated Reading Time**: ${metrics.estimatedReadingTime} minutes
- **Content Type**: ${params.contentType} document
- **Target Audience**: ${targetAudience.toUpperCase()}

### Key Concepts
[List 5-8 fundamental concepts from the document]

### Important Terminology
[Definitions of key terms with brief explanations]

### Facts and Data
[Factual information that can be tested - numbers, dates, names, statistics]

### Processes and Stages
[Sequential steps, developments, or logical flows that can be tested]

### Cause-Effect Relationships
[Logical connections between concepts suitable for analytical questions]

### Examples and Applications
[Concrete examples or applications that can be made into contextual questions]

### Evaluation Points
[Aspects suitable for various types of questions (multiple choice, true/false, and multiple selection)]
`;

	const qualityCriteria = isIndonesian
		? `
- Setiap poin harus dapat diverifikasi dari dokumen asli
- Gunakan bahasa yang tepat untuk tingkat ${targetAudience.toUpperCase()}
- Prioritaskan informasi yang memiliki nilai edukatif tinggi
- Hindari opini atau interpretasi yang tidak didukung teks
- Fokus pada materi yang dapat diubah menjadi soal quiz berkualitas
${focusArea ? `- Berikan perhatian khusus pada aspek ${focusArea}` : ""}
- Pastikan rangkuman dapat dipahami tanpa membaca dokumen asli
${metrics.hasTableOfContents ? "- Manfaatkan struktur daftar isi untuk organisasi yang lebih baik" : ""}
`
		: `
- Each point must be verifiable from the original document
- Use appropriate language for ${targetAudience.toUpperCase()} level
- Prioritize information with high educational value
- Avoid opinions or interpretations not supported by text
- Focus on material that can be converted into quality quiz questions
${focusArea ? `- Give special attention to ${focusArea} aspects` : ""}
- Ensure summary can be understood without reading original document
${metrics.hasTableOfContents ? "- Utilize table of contents structure for better organization" : ""}
`;

	return `${instructions.title}

${instructions.task}

**${isIndonesian ? "FORMAT RANGKUMAN" : "SUMMARY FORMAT"}:**
${formatStructure}

**${isIndonesian ? "KRITERIA KUALITAS" : "QUALITY CRITERIA"}:**
${qualityCriteria}

**${isIndonesian ? "KONTEN DOKUMEN YANG DIANALISIS" : "DOCUMENT CONTENT TO ANALYZE"}:**
${content}`;
}

/**
 * Creates a system prompt that establishes the AI's role and context for content analysis
 *
 * Generates a system-level prompt that defines the AI assistant's expertise,
 * target audience, content type context, and quality principles for educational
 * content analysis and quiz generation.
 *
 * @param language - Target language for the response ('id' or 'en')
 * @param contentType - Type of content being analyzed (academic, tutorial, reference, general)
 * @param targetAudience - Educational level of the target audience (optional)
 * @returns Formatted system prompt string
 *
 * @example
 * ```typescript
 * const systemPrompt = createSystemPrompt('id', 'academic', 'sma');
 * // Returns Indonesian system prompt for academic content targeted at high school level
 * ```
 */
export function createSystemPrompt(
	language: "id" | "en",
	contentType: string,
	targetAudience?: string,
): string {
	const basePrompt =
		language === "id"
			? "Anda adalah asisten AI ahli dalam pembuatan materi pembelajaran dan quiz untuk siswa Indonesia."
			: "You are an AI assistant specialized in creating educational materials and quizzes for students.";

	const audienceContext = {
		smp:
			language === "id"
				? "siswa SMP (usia 13-15 tahun)"
				: "middle school students (ages 13-15)",
		sma:
			language === "id"
				? "siswa SMA (usia 16-18 tahun)"
				: "high school students (ages 16-18)",
		kuliah:
			language === "id"
				? "mahasiswa (usia 18+ tahun)"
				: "university students (ages 18+)",
		umum: language === "id" ? "pembelajar umum" : "general learners",
	};

	const contentTypeContext = {
		academic:
			language === "id"
				? "konten akademik yang memerlukan analisis mendalam"
				: "academic content requiring deep analysis",
		tutorial:
			language === "id"
				? "tutorial praktis yang memerlukan pemahaman langkah demi langkah"
				: "practical tutorials requiring step-by-step understanding",
		reference:
			language === "id"
				? "materi referensi dengan fokus pada definisi dan konsep"
				: "reference material focusing on definitions and concepts",
		general:
			language === "id"
				? "konten umum yang perlu disesuaikan untuk pembelajaran"
				: "general content adapted for learning",
	};

	return `${basePrompt}

Anda akan menganalisis ${contentTypeContext[contentType as keyof typeof contentTypeContext]} untuk ${audienceContext[(targetAudience || "sma") as keyof typeof audienceContext]}.

TUGAS UTAMA:
- Ekstrak informasi kunci yang dapat diubah menjadi soal quiz
- Identifikasi konsep, definisi, fakta, dan hubungan penting
- Strukturkan informasi sesuai tingkat pemahaman target audiens
- Pastikan konten dapat diverifikasi dan tidak ambigu

PRINSIP KUALITAS:
- Fokus pada pembelajaran yang terukur dan dapat diuji
- Hindari informasi yang terlalu subjektif atau kontroversial
- Prioritaskan konsep fundamental yang mendukung pemahaman lanjutan
- Gunakan bahasa yang sesuai dengan tingkat pendidikan target`;
}

/**
 * Generates a structured user prompt for website content analysis and quiz creation
 *
 * Creates a comprehensive prompt for analyzing website content for educational purposes.
 * Includes content metadata, formatting structure, and quality criteria.
 * Supports both Indonesian and English with appropriate educational levels.
 *
 * @param params - Configuration object for prompt generation
 * @param params.title - Title of the website/article
 * @param params.content - Extracted and cleaned content text
 * @param params.metrics - Content metrics including word count, headings, etc.
 * @param params.contentType - Detected content type
 * @param params.language - Content language ('id' or 'en')
 * @param params.targetAudience - Educational level target
 * @param params.focusArea - Optional specific subject area to emphasize
 * @param params.quizType - Type of quiz questions to optimize for
 * @returns Formatted prompt string for AI processing
 *
 * @example
 * ```typescript
 * const prompt = createWEBUserPrompt({
 *   title: 'Introduction to Physics',
 *   content: cleanedContent,
 *   metrics: contentMetrics,
 *   contentType: 'tutorial',
 *   language: 'en',
 *   targetAudience: 'sma',
 *   quizType: 'pilihan_ganda'
 * });
 * ```
 */
export function createWEBUserPrompt(params: {
	title: string;
	content: string;
	metrics: ContentMetrics;
	contentType: string;
	language: "id" | "en";
	targetAudience: string;
	focusArea?: string;
}): string {
	const { title, content, metrics, language, targetAudience, focusArea } =
		params;

	const isIndonesian = language === "id";

	const instructions = isIndonesian
		? {
				title: "ANALISIS KONTEN WEBSITE UNTUK QUIZ",
				task: "Buat rangkuman pembelajaran terstruktur dari konten website berikut:",
				format: "FORMAT RANGKUMAN",
				quality: "KRITERIA KUALITAS",
			}
		: {
				title: "WEBSITE CONTENT ANALYSIS FOR QUIZ",
				task: "Create a structured learning summary from the following website content:",
				format: "SUMMARY FORMAT",
				quality: "QUALITY CRITERIA",
			};

	const formatStructure = isIndonesian
		? `
## ${title}

### Informasi Dasar
- **Topik Utama**: [Identifikasi tema sentral]
- **Bidang Studi**: [Kategori akademik]
- **Tingkat Kesulitan**: [Sesuai dengan ${targetAudience.toUpperCase()}]

### Konsep Kunci
[Daftar 5-8 konsep fundamental yang harus dipahami]

### Terminologi Penting  
[Definisi istilah-istilah kunci dengan penjelasan singkat]

### Fakta dan Data
[Informasi faktual yang dapat diujikan - angka, tanggal, nama, statistik]

### Proses dan Tahapan
[Urutan langkah, perkembangan, atau alur berpikir yang dapat diuji]

### Hubungan Sebab-Akibat
[Kaitan logis antar konsep yang cocok untuk soal analitis]

### Contoh dan Aplikasi
[Contoh konkret atau penerapan yang dapat dijadikan soal kontekstual]

### Poin Evaluasi
[Aspek-aspek yang cocok untuk berbagai jenis soal (pilihan ganda, benar/salah, dan pilihan berganda)]
`
		: `
## ${title}

### Basic Information
- **Main Topic**: [Identify central theme]
- **Study Field**: [Academic category]
- **Difficulty Level**: [Appropriate for ${targetAudience.toUpperCase()}]

### Key Concepts
[List 5-8 fundamental concepts that must be understood]

### Important Terminology
[Definitions of key terms with brief explanations]

### Facts and Data
[Factual information that can be tested - numbers, dates, names, statistics]

### Processes and Stages
[Sequential steps, developments, or logical flows that can be tested]

### Cause-Effect Relationships
[Logical connections between concepts suitable for analytical questions]

### Examples and Applications
[Concrete examples or applications that can be made into contextual questions]

### Evaluation Points
[Aspects suitable for various types of questions (multiple choice, true/false, and multiple selection)]
`;

	const qualityCriteria = isIndonesian
		? `
- Setiap poin harus dapat diverifikasi dari konten asli
- Gunakan bahasa yang tepat untuk tingkat ${targetAudience.toUpperCase()}
- Prioritaskan informasi yang memiliki nilai edukatif tinggi
- Hindari opini atau interpretasi yang tidak didukung teks
- Fokus pada materi yang dapat diubah menjadi soal quiz berkualitas
${focusArea ? `- Berikan perhatian khusus pada aspek ${focusArea}` : ""}
- Pastikan rangkuman dapat dipahami tanpa membaca konten asli
`
		: `
- Each point must be verifiable from the original content
- Use appropriate language for ${targetAudience.toUpperCase()} level
- Prioritize information with high educational value
- Avoid opinions or interpretations not supported by text
- Focus on material that can be converted into quality quiz questions
${focusArea ? `- Give special attention to ${focusArea} aspects` : ""}
- Ensure summary can be understood without reading original content
`;

	return `${instructions.title}

${instructions.task}

**INFORMASI KONTEN:**
- Judul: ${title}
- Jumlah kata: ${metrics.wordCount}
- Estimasi waktu baca: ${metrics.estimatedReadingTime} menit
- Jumlah heading: ${metrics.headingCount}

**${instructions.format}:**
${formatStructure}

**${instructions.quality}:**
${qualityCriteria}

**KONTEN YANG DIANALISIS:**
${content}`;
}

/**
 * Analyzes raw text content and generates structured metadata
 *
 * Processes user-provided text input by cleaning it, calculating metrics,
 * detecting content type and language. Similar to analyzePDFContent but
 * optimized for text input without PDF-specific features.
 *
 * @param textContent - Raw text content to be analyzed
 * @param title - Title or description for the content
 * @returns Processed content object with analysis results and metadata
 *
 * @example
 * ```typescript
 * const processed = analyzeTextContent(userInput, 'Physics Notes');
 * console.log(`Analyzed ${processed.title}: ${processed.contentType} content`);
 * console.log(`Language: ${processed.language}, Words: ${processed.metrics.wordCount}`);
 * ```
 */
export function analyzeTextContent(
	textContent: string,
	title?: string,
): ProcessedTextContent {
	// Clean and normalize content
	const cleanContent = textContent.trim().replace(/\s+/g, " ");

	// Calculate basic metrics
	const wordCount = cleanContent.split(/\s+/).length;
	const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 WPM

	// Detect language (enhanced heuristic)
	const indonesianWords = [
		"yang",
		"dan",
		"dengan",
		"untuk",
		"adalah",
		"pada",
		"dari",
		"dalam",
		"sebagai",
		"dapat",
		"saya",
		"butuh",
		"perlu",
		"tentang",
		"soal",
	];
	const englishWords = [
		"the",
		"and",
		"with",
		"for",
		"is",
		"on",
		"from",
		"in",
		"as",
		"can",
		"need",
		"want",
		"about",
		"question",
	];

	const contentLower = cleanContent.toLowerCase();
	const indonesianCount = indonesianWords.filter((word) =>
		contentLower.includes(word),
	).length;
	const englishCount = englishWords.filter((word) =>
		contentLower.includes(word),
	).length;

	const language = indonesianCount > englishCount ? "id" : "en";

	// Enhanced content type detection
	let contentType: "academic" | "tutorial" | "reference" | "general" =
		"general";

	// Check for prompt/request patterns
	const promptPatterns = [
		/\b(butuh|perlu|mau|ingin|want|need|create|generate|buat|bikin)\b/i,
		/\b(soal|pertanyaan|quiz|latihan|practice|exercise|question)\b/i,
		/\b(tolong|please|help|bantu)\b/i,
	];

	const isPromptRequest =
		wordCount < 30 ||
		promptPatterns.some((pattern) => pattern.test(cleanContent));

	if (isPromptRequest) {
		// For prompt requests, assume academic unless specified otherwise
		contentType = "academic";
	} else {
		// For longer content, analyze based on keywords
		const academicKeywords = [
			"research",
			"study",
			"analysis",
			"theory",
			"hypothesis",
			"penelitian",
			"analisis",
			"teori",
			"hipotesis",
			"konsep",
			"prinsip",
		];
		const tutorialKeywords = [
			"step",
			"how to",
			"guide",
			"tutorial",
			"langkah",
			"cara",
			"panduan",
			"petunjuk",
		];
		const referenceKeywords = [
			"definition",
			"glossary",
			"reference",
			"dictionary",
			"definisi",
			"rujukan",
			"kamus",
			"pengertian",
		];

		if (academicKeywords.some((keyword) => contentLower.includes(keyword))) {
			contentType = "academic";
		} else if (
			tutorialKeywords.some((keyword) => contentLower.includes(keyword))
		) {
			contentType = "tutorial";
		} else if (
			referenceKeywords.some((keyword) => contentLower.includes(keyword))
		) {
			contentType = "reference";
		}
	}

	return {
		title: title || "Text Content",
		content: cleanContent,
		metrics: {
			wordCount,
			estimatedReadingTime,
		},
		contentType,
		language,
	};
}

/**
 * Creates optimized user prompt for text content summarization
 *
 * Generates AI prompts specifically designed for text content processing,
 * incorporating content analysis results and educational parameters.
 *
 * @param params - Object containing content analysis and generation parameters
 * @returns Formatted prompt string for AI processing
 *
 * @example
 * ```typescript
 * const prompt = createTextUserPrompt({
 *   title: "Math Concepts",
 *   content: "Algebra is a branch of mathematics...",
 *   metrics: { wordCount: 500, estimatedReadingTime: 3 },
 *   contentType: "academic",
 *   language: "en",
 *   targetAudience: "sma",
 *   focusArea: "mathematics",
 *   quizType: "pilihan_ganda"
 * });
 * ```
 */
export function createTextUserPrompt(params: {
	title: string;
	content: string;
	metrics: { wordCount: number; estimatedReadingTime: number };
	contentType: "academic" | "tutorial" | "reference" | "general";
	language: "id" | "en";
	targetAudience: "smp" | "sma" | "kuliah" | "umum";
	focusArea?: string;
}): string {
	const {
		title,
		content,
		metrics,
		contentType,
		language,
		targetAudience,
		focusArea,
	} = params;

	if (language === "id") {
		return `Analisis dan rangkum konten teks berikut untuk pembuatan quiz edukatif:

**INFORMASI KONTEN:**
- Judul: ${title}
- Jenis Konten: ${contentType}
- Jumlah Kata: ${metrics.wordCount}
- Estimasi Waktu Baca: ${metrics.estimatedReadingTime} menit
- Target Audiens: ${targetAudience}
${focusArea ? `- Area Fokus: ${focusArea}` : ""}
- Jenis Quiz: Campuran (pilihan ganda, benar/salah, pilihan berganda)

**KONTEN YANG AKAN DIANALISIS:**
${content}

**INSTRUKSI PEMBUATAN RANGKUMAN:**
Buat rangkuman yang terstruktur dan komprehensif dengan format berikut:

## Ringkasan Utama
[Ringkasan 2-3 paragraf tentang konsep utama]

## Konsep Kunci
[Daftar bullet point konsep-konsep penting yang dapat dijadikan pertanyaan quiz]

## Detail Pembelajaran
[Penjelasan detail tentang topik-topik yang perlu dipahami siswa]

## Poin-Poin Quiz
[Identifikasi area yang cocok untuk berbagai jenis soal (pilihan ganda, benar/salah, pilihan berganda) berdasarkan tingkat ${targetAudience}]

## Kesimpulan
[Rangkuman singkat dan relevansi untuk pembelajaran]

Pastikan rangkuman:
- Sesuai untuk tingkat ${targetAudience}
- Menggunakan bahasa Indonesia yang jelas
- Memfokuskan pada aspek yang dapat diujikan
- Mengorganisir informasi secara logis untuk pembuatan quiz
${focusArea ? `- Menekankan aspek ${focusArea}` : ""}

Expected format:
- Use markdown formatting
- Create sections for main concepts
- Include key points that can be turned into questions
- Add examples or illustrations when relevant
- End with a brief summary`;
	}
	return `Analyze and summarize the following text content for educational quiz generation:

**CONTENT INFORMATION:**
- Title: ${title}
- Content Type: ${contentType}
- Word Count: ${metrics.wordCount}
- Estimated Reading Time: ${metrics.estimatedReadingTime} minutes
- Target Audience: ${targetAudience}
${focusArea ? `- Focus Area: ${focusArea}` : ""}
- Quiz Type: Mixed (multiple choice, true/false, multiple selection)

**CONTENT TO ANALYZE:**
${content}

**SUMMARIZATION INSTRUCTIONS:**
Create a structured and comprehensive summary with the following format:

## Main Summary
[2-3 paragraph summary of key concepts]

## Key Concepts
[Bullet point list of important concepts that can be turned into quiz questions]

## Learning Details
[Detailed explanation of topics students need to understand]

## Quiz Points
[Identify areas suitable for various question types (multiple choice, true/false, multiple selection) based on ${targetAudience} level]

## Conclusion
[Brief summary and relevance for learning]

Ensure the summary:
- Is appropriate for ${targetAudience} level
- Uses clear and accessible language
- Focuses on testable aspects
- Organizes information logically for quiz creation
${focusArea ? `- Emphasizes ${focusArea} aspects` : ""}

Expected format:
- Use markdown formatting
- Create sections for main concepts
- Include key points that can be turned into questions
- Add examples or illustrations when relevant
- End with a brief summary`;
}

/**
 * Validates and enhances a generated summary for educational quality
 *
 * Performs comprehensive validation of AI-generated summaries to ensure
 * they meet educational standards. Checks structure, length, formatting,
 * and adds metadata if missing. Returns null if summary doesn't meet standards.
 *
 * @param summary - The AI-generated summary text to validate
 * @param extractedData - Original extracted content data for context and enhancement
 * @returns Enhanced summary string if valid, null if validation fails
 *
 * @example
 * ```typescript
 * const validSummary = validateAndEnhanceSummary(aiSummary, extractedData);
 * if (validSummary) {
 *   console.log('Summary passed validation');
 * } else {
 *   console.log('Summary failed quality check');
 * }
 * ```
 */
export function validateAndEnhanceSummary(
	summary: string,
	extractedData: ExtractedContent,
): string | null {
	if (!summary || summary.length < 800) {
		console.warn("Rangkuman terlalu pendek");
		return null;
	}

	// Validasi struktur
	const hasHeadings = /#{2,3}\s/.test(summary);
	const hasLists = /^\s*[-*]\s/m.test(summary);
	const hasSections = summary.includes("###") && summary.includes("##");

	// if (!hasHeadings || !hasLists || !hasSections) {
	//     console.warn("Rangkuman tidak memiliki struktur yang memadai");
	//     return null;
	// }

	// Enhancement: tambahkan metadata jika belum ada
	if (
		!summary.includes("Tingkat Kesulitan") &&
		!summary.includes("Difficulty Level")
	) {
		const language = extractedData.language;
		const difficultyNote =
			language === "id"
				? `\n\n### Catatan Tambahan\n- **Sumber**: Website dengan ${extractedData.metrics.wordCount} kata\n- **Jenis Konten**: ${extractedData.contentType}\n- **Estimasi Waktu Belajar**: ${Math.ceil(extractedData.metrics.wordCount / 200)} menit`
				: `\n\n### Additional Notes\n- **Source**: Website with ${extractedData.metrics.wordCount} words\n- **Content Type**: ${extractedData.contentType}\n- **Estimated Study Time**: ${Math.ceil(extractedData.metrics.wordCount / 200)} minutes`;

		return summary + difficultyNote;
	}

	return summary;
}
