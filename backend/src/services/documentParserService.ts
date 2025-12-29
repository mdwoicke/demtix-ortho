/**
 * Document Parser Service
 * Extracts text content from various document formats (PDF, DOCX, XLSX, TXT, MD)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse');
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_LENGTH = 500000; // 500K chars max extracted text

export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'text/plain': '.txt',
  'text/markdown': '.md',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.docx', '.xlsx'];

// ============================================================================
// TYPES
// ============================================================================

export interface ParseResult {
  success: boolean;
  text?: string;
  error?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(filename: string): string | null {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));

  for (const [mimeType, extension] of Object.entries(SUPPORTED_MIME_TYPES)) {
    if (extension === ext) {
      return mimeType;
    }
  }

  // Handle common variations
  if (ext === '.txt') return 'text/plain';
  if (ext === '.md') return 'text/markdown';

  return null;
}

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return mimeType in SUPPORTED_MIME_TYPES;
}

/**
 * Check if file size is within limits
 */
export function isFileSizeValid(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * Get human-readable max file size
 */
export function getMaxFileSizeDisplay(): string {
  return `${MAX_FILE_SIZE / 1024 / 1024}MB`;
}

// ============================================================================
// PARSERS
// ============================================================================

/**
 * Parse plain text file
 */
function parseTextFile(buffer: Buffer): ParseResult {
  try {
    const text = buffer.toString('utf-8');
    return { success: true, text };
  } catch (error: any) {
    return { success: false, error: `Failed to parse text file: ${error.message}` };
  }
}

/**
 * Parse PDF file
 */
async function parsePdfFile(buffer: Buffer): Promise<ParseResult> {
  try {
    const data = await pdf(buffer);
    return { success: true, text: data.text };
  } catch (error: any) {
    return { success: false, error: `Failed to parse PDF: ${error.message}` };
  }
}

/**
 * Parse DOCX file
 */
async function parseDocxFile(buffer: Buffer): Promise<ParseResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });

    // Check for any warnings
    if (result.messages.length > 0) {
      const warnings = result.messages
        .filter(m => m.type === 'warning')
        .map(m => m.message)
        .join('; ');

      if (warnings) {
        console.warn(`DOCX parsing warnings: ${warnings}`);
      }
    }

    return { success: true, text: result.value };
  } catch (error: any) {
    return { success: false, error: `Failed to parse DOCX: ${error.message}` };
  }
}

/**
 * Parse XLSX file
 */
function parseXlsxFile(buffer: Buffer): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Extract text from all sheets
    const sheets = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      const text = XLSX.utils.sheet_to_txt(sheet);
      return `## Sheet: ${name}\n${text}`;
    });

    return { success: true, text: sheets.join('\n\n') };
  } catch (error: any) {
    return { success: false, error: `Failed to parse XLSX: ${error.message}` };
  }
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse a document and extract text content
 *
 * @param buffer - File content as a buffer
 * @param mimeType - MIME type of the file
 * @param filename - Original filename (for logging)
 * @returns ParseResult with extracted text or error
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParseResult> {
  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      success: false,
      error: `File exceeds maximum size of ${getMaxFileSizeDisplay()}`,
    };
  }

  // Validate MIME type
  if (!isSupportedMimeType(mimeType)) {
    return {
      success: false,
      error: `Unsupported file type: ${mimeType}. Supported types: ${Object.keys(SUPPORTED_MIME_TYPES).join(', ')}`,
    };
  }

  let result: ParseResult;

  try {
    switch (mimeType) {
      case 'text/plain':
      case 'text/markdown':
        result = parseTextFile(buffer);
        break;

      case 'application/pdf':
        result = await parsePdfFile(buffer);
        break;

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        result = await parseDocxFile(buffer);
        break;

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        result = parseXlsxFile(buffer);
        break;

      default:
        return { success: false, error: `Unsupported file type: ${mimeType}` };
    }

    // Truncate if text is too long
    if (result.success && result.text && result.text.length > MAX_TEXT_LENGTH) {
      result.text = result.text.substring(0, MAX_TEXT_LENGTH) +
        '\n\n[Content truncated due to length - extracted first 500K characters]';
    }

    return result;
  } catch (error: any) {
    console.error(`Error parsing document ${filename}:`, error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred while parsing the document',
    };
  }
}

/**
 * Get default label from filename (removes extension)
 */
export function getDefaultLabelFromFilename(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return filename.substring(0, lastDotIndex);
  }
  return filename;
}
