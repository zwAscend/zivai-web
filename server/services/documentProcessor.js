import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

/**
 * Extract text from a document based on its MIME type
 * @param {Object} resource - The resource document from the database
 * @returns {Promise<string>} - Extracted text content
 */
export const extractTextFromDocument = async (resource) => {
  try {
    const filePath = path.join(process.cwd(), 'uploads', resource.key);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found on server');
    }

    // Handle different file types
    const mimeType = resource.mimeType || '';
    
    if (mimeType === 'application/pdf') {
      return await extractTextFromPDF(filePath);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractTextFromDocx(filePath);
    } else if (mimeType === 'application/msword' || mimeType === 'text/plain') {
      return await extractTextFromTextFile(filePath);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error('Error extracting text from document:', error);
    throw new Error(`Failed to process document: ${error.message}`);
  }
};

/**
 * Extract text from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text
 */
const extractTextFromPDF = async (filePath) => {
  try {
    const dataBuffer = await readFile(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

/**
 * Extract text from a DOCX file
 * @param {string} filePath - Path to the DOCX file
 * @returns {Promise<string>} - Extracted text
 */
const extractTextFromDocx = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from Word document');
  }
};

/**
 * Extract text from a plain text file
 * @param {string} filePath - Path to the text file
 * @returns {Promise<string>} - File content
 */
const extractTextFromTextFile = async (filePath) => {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    console.error('Error reading text file:', error);
    throw new Error('Failed to read text file');
  }
};

/**
 * Clean up temporary files
 * @param {string} filePath - Path to the file to delete
 */
export const cleanupTempFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      await unlink(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up temporary file:', error);
    // Don't throw error for cleanup failures
  }
};
